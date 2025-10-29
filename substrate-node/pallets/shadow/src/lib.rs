//! # Shadow Pallet
//!
//! A pallet for storing encrypted Web2 activity metadata on-chain.

#![cfg_attr(not(feature = "std"), no_std)]

// Re-export pallet items so that they can be accessed from the crate namespace.
pub use pallet::*;

// Import codec traits for encoding/decoding
use codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_runtime::{traits::{Hash, SaturatedConversion}, RuntimeDebug};

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
pub mod weights;
pub use weights::*;

#[frame_support::pallet]
pub mod pallet {
	use super::*;
	use frame_support::pallet_prelude::*;
	use frame_system::pallet_prelude::*;
	use sp_std::vec::Vec;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// The pallet's configuration trait.
	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// The overarching event type.
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// Weight information for extrinsics in this pallet.
		type WeightInfo: WeightInfo;
	}

	/// Storage map for shadow items by account.
	#[pallet::storage]
	pub type ShadowItems<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		Vec<ShadowItem>,
		ValueQuery,
	>;

	/// Storage map for consent records by account.
	#[pallet::storage]
	pub type ConsentRecords<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		ConsentRecord<BlockNumberFor<T>>,
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
			ensure!(cid.len() <= 100, Error::<T>::CidTooLong);
			ensure!(encrypted_key.len() <= 512, Error::<T>::KeyTooLong);
			ensure!(metadata.len() <= 256, Error::<T>::MetadataTooLong);
			ensure!(source <= 1, Error::<T>::InvalidSource);

			// Generate unique ID for this item
			let nonce = frame_system::Pallet::<T>::account_nonce(&who);
			let item_id = <T::Hashing as Hash>::hash_of(&(&who, &nonce, &cid));

			// Create the shadow item
			let item = ShadowItem {
				id: item_id.encode(),
				cid: cid.clone(),
				encrypted_key,
				timestamp: <BlockNumberFor<T> as SaturatedConversion>::saturated_into::<u64>(frame_system::Pallet::<T>::block_number()),
				source,
				metadata,
			};

			// Store the item
			<ShadowItems<T>>::mutate(&who, |items| {
				items.push(item);
			});

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
					let id = T::Hash::decode(&mut &item.id[..]).unwrap_or_default();
					id != item_id
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

			// Store consent record
			<ConsentRecords<T>>::insert(
				&who,
				ConsentRecord {
					granted_at: current_block,
					expires_at,
					message_hash: message_hash.clone(),
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

/// A shadow item stored on-chain.
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct ShadowItem {
	/// Unique identifier for the item.
	pub id: Vec<u8>,
	/// IPFS content identifier.
	pub cid: Vec<u8>,
	/// Encrypted symmetric key.
	pub encrypted_key: Vec<u8>,
	/// Timestamp when the item was stored.
	pub timestamp: u64,
	/// Source of the content (0 = GitHub, 1 = Twitter).
	pub source: u8,
	/// Additional metadata.
	pub metadata: Vec<u8>,
}

/// A consent record stored on-chain.
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct ConsentRecord<BlockNumber> {
	/// Block number when consent was granted.
	pub granted_at: BlockNumber,
	/// Optional block number when consent expires.
	pub expires_at: Option<BlockNumber>,
	/// Hash of the consent message.
	pub message_hash: Vec<u8>,
}