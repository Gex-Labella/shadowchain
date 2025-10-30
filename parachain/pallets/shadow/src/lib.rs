//! # Shadow Pallet
//!
//! A pallet for storing encrypted Web2 activity metadata on-chain.

#![cfg_attr(not(feature = "std"), no_std)]

// Re-export pallet items so that they can be accessed from the crate namespace.
pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
pub mod weights;
pub use weights::WeightInfo;

#[frame::pallet]
pub mod pallet {
	use frame::prelude::*;
	use super::WeightInfo;
	
	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// The pallet's configuration trait.
	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// The overarching event type.
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
		
		/// Weight information for extrinsics in this pallet.
		type WeightInfo: WeightInfo;
		
		/// Maximum number of shadow items per account
		#[pallet::constant]
		type MaxItemsPerAccount: Get<u32>;
		
		/// Maximum length for CID
		#[pallet::constant]
		type MaxCidLength: Get<u32>;
		
		/// Maximum length for encrypted key
		#[pallet::constant]
		type MaxKeyLength: Get<u32>;
		
		/// Maximum length for metadata
		#[pallet::constant]
		type MaxMetadataLength: Get<u32>;
		
		/// Maximum length for message hash
		#[pallet::constant]
		type MaxMessageHashLength: Get<u32>;
	}

	/// Type aliases for bounded vectors
	pub type BoundedCid<T> = BoundedVec<u8, <T as Config>::MaxCidLength>;
	pub type BoundedKey<T> = BoundedVec<u8, <T as Config>::MaxKeyLength>;
	pub type BoundedMetadata<T> = BoundedVec<u8, <T as Config>::MaxMetadataLength>;
	pub type BoundedMessageHash<T> = BoundedVec<u8, <T as Config>::MaxMessageHashLength>;

	/// A shadow item stored on-chain.
	#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	pub struct ShadowItem<T: Config> {
		/// Unique identifier for the item.
		pub id: [u8; 32],  // Fixed size for hash output
		/// IPFS content identifier.
		pub cid: BoundedCid<T>,
		/// Encrypted symmetric key.
		pub encrypted_key: BoundedKey<T>,
		/// Timestamp when the item was stored.
		pub timestamp: u64,
		/// Source of the content (0 = GitHub, 1 = Twitter).
		pub source: u8,
		/// Additional metadata.
		pub metadata: BoundedMetadata<T>,
	}

	/// A consent record stored on-chain.
	#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	pub struct ConsentRecord<T: Config, BlockNumber> {
		/// Block number when consent was granted.
		pub granted_at: BlockNumber,
		/// Optional block number when consent expires.
		pub expires_at: Option<BlockNumber>,
		/// Hash of the consent message.
		pub message_hash: BoundedMessageHash<T>,
	}

	/// Storage map for shadow items by account.
	#[pallet::storage]
	pub type ShadowItems<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		BoundedVec<ShadowItem<T>, T::MaxItemsPerAccount>,
		ValueQuery,
	>;

	/// Storage map for consent records by account.
	#[pallet::storage]
	pub type ConsentRecords<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		ConsentRecord<T, BlockNumberFor<T>>,
		OptionQuery,
	>;

	/// Events emitted by the pallet.
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A shadow item was stored. [who, item_id, cid]
		ShadowItemStored { who: T::AccountId, item_id: T::Hash, cid: Vec<u8> },
		/// A shadow item was deleted. [who, item_id]
		ShadowItemDeleted { who: T::AccountId, item_id: T::Hash },
		/// Consent was granted. [who, message_hash]
		ConsentGranted { who: T::AccountId, message_hash: Vec<u8> },
		/// Consent was revoked. [who]
		ConsentRevoked { who: T::AccountId },
	}

	/// Errors that can occur in the pallet.
	#[pallet::error]
	pub enum Error<T> {
		/// The CID is too long.
		CidTooLong,
		/// The encrypted key is too long.
		KeyTooLong,
		/// The metadata is too long.
		MetadataTooLong,
		/// The account has too many items.
		TooManyItems,
		/// Item not found.
		ItemNotFound,
		/// Invalid source value.
		InvalidSource,
		/// No consent record found.
		NoConsent,
		/// Consent has expired.
		ConsentExpired,
	}

	#[pallet::hooks]
	impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {}

	/// Dispatchable calls that can be made to the pallet.
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a new shadow item to the chain.
		///
		/// - `cid`: The IPFS content identifier for the encrypted data.
		/// - `encrypted_key`: The encrypted symmetric key for decrypting the content.
		/// - `source`: The source of the content (0 = GitHub, 1 = Twitter).
		/// - `metadata`: Additional metadata about the item.
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::submit_shadow_item())]
		pub fn submit_shadow_item(
			origin: OriginFor<T>,
			cid: Vec<u8>,
			encrypted_key: Vec<u8>,
			source: u8,
			metadata: Vec<u8>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// Check consent
			Self::ensure_valid_consent(&who)?;

			// Validate inputs
			ensure!(cid.len() <= T::MaxCidLength::get() as usize, Error::<T>::CidTooLong);
			ensure!(encrypted_key.len() <= T::MaxKeyLength::get() as usize, Error::<T>::KeyTooLong);
			ensure!(metadata.len() <= T::MaxMetadataLength::get() as usize, Error::<T>::MetadataTooLong);
			ensure!(source <= 1, Error::<T>::InvalidSource);

			// Generate unique ID for this item
			let nonce = frame_system::Pallet::<T>::account_nonce(&who);
			let item_id = T::Hashing::hash_of(&(&who, &nonce, &cid));
			
			// Convert vecs to bounded vecs
			let bounded_cid = BoundedCid::<T>::try_from(cid.clone())
				.map_err(|_| Error::<T>::CidTooLong)?;
			let bounded_key = BoundedKey::<T>::try_from(encrypted_key)
				.map_err(|_| Error::<T>::KeyTooLong)?;
			let bounded_metadata = BoundedMetadata::<T>::try_from(metadata)
				.map_err(|_| Error::<T>::MetadataTooLong)?;

			// Create the shadow item
			let item = ShadowItem {
				id: item_id.as_ref().try_into().map_err(|_| Error::<T>::InvalidSource)?,
				cid: bounded_cid,
				encrypted_key: bounded_key,
				timestamp: frame_system::Pallet::<T>::block_number().saturated_into::<u64>(),
				source,
				metadata: bounded_metadata,
			};

			// Store the item
			<ShadowItems<T>>::try_mutate(&who, |items| -> DispatchResult {
				items.try_push(item).map_err(|_| Error::<T>::TooManyItems)?;
				Ok(())
			})?;

			// Emit event
			Self::deposit_event(Event::ShadowItemStored { who, item_id, cid });

			Ok(())
		}

		/// Delete a shadow item.
		///
		/// - `item_id`: The ID of the item to delete.
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::delete_shadow_item())]
		pub fn delete_shadow_item(origin: OriginFor<T>, item_id: T::Hash) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// Remove the item if it exists
			<ShadowItems<T>>::mutate(&who, |items| {
				items.retain(|item| {
					// Compare the hash directly with the stored id
					let stored_id = T::Hash::decode(&mut &item.id[..]).unwrap_or_default();
					stored_id != item_id
				});
			});

			// Emit event
			Self::deposit_event(Event::ShadowItemDeleted { who, item_id });

			Ok(())
		}

		/// Grant consent for the backend to submit shadow items on behalf of the user.
		///
		/// - `message_hash`: Hash of the consent message.
		/// - `duration`: Optional duration in blocks for consent validity.
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::grant_consent())]
		pub fn grant_consent(
			origin: OriginFor<T>,
			message_hash: Vec<u8>,
			duration: Option<BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			let current_block = frame_system::Pallet::<T>::block_number();
			let expires_at = duration.map(|d| current_block + d);

			// Convert message hash to bounded vec
			let bounded_hash = BoundedMessageHash::<T>::try_from(message_hash.clone())
				.map_err(|_| DispatchError::Other("Message hash too long"))?;

			// Store consent record
			<ConsentRecords<T>>::insert(
				&who,
				ConsentRecord {
					granted_at: current_block,
					expires_at,
					message_hash: bounded_hash,
				},
			);

			// Emit event
			Self::deposit_event(Event::ConsentGranted { who, message_hash });

			Ok(())
		}

		/// Revoke consent for the backend to submit shadow items.
		#[pallet::call_index(3)]
		#[pallet::weight(T::WeightInfo::revoke_consent())]
		pub fn revoke_consent(origin: OriginFor<T>) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// Remove consent record
			<ConsentRecords<T>>::remove(&who);

			// Emit event
			Self::deposit_event(Event::ConsentRevoked { who });

			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Check if an account has valid consent.
		pub fn ensure_valid_consent(account: &T::AccountId) -> DispatchResult {
			let consent = <ConsentRecords<T>>::get(account).ok_or(Error::<T>::NoConsent)?;

			if let Some(expires_at) = consent.expires_at {
				let current_block = frame_system::Pallet::<T>::block_number();
				ensure!(current_block <= expires_at, Error::<T>::ConsentExpired);
			}

			Ok(())
		}
	}
}