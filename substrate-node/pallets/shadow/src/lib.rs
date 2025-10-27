//! # Shadow Pallet
//!
//! The Shadow pallet provides functionality for storing encrypted Web2 activity metadata
//! on-chain with IPFS content references.
//!
//! ## Overview
//!
//! The Shadow pallet enables users to:
//! - Store shadow items containing IPFS CIDs and encrypted symmetric keys
//! - Query their shadow items
//! - Manage consent for automated syncing
//! - Soft-delete items
//!
//! ## Interface
//!
//! ### Dispatchable Functions
//!
//! * `submit_shadow_item` - Submit a new shadow item with encrypted content reference
//! * `delete_shadow_item` - Soft-delete a shadow item
//! * `grant_consent` - Grant consent for automated syncing
//! * `revoke_consent` - Revoke previously granted consent

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{
    dispatch::DispatchResult,
    pallet_prelude::*,
    traits::{Currency, Time},
    weights::Weight,
    BoundedVec,
};
use frame_system::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_runtime::{
    traits::{Hash, Saturating},
    RuntimeDebug,
};
use sp_std::{prelude::*, vec::Vec};

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

/// Type alias for the balance type
type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

/// Source of shadow content
#[derive(Clone, PartialEq, Eq, RuntimeDebug, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum ContentSource {
    GitHub,
    Twitter,
}

/// A shadow item stored on-chain
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct ShadowItem<T: Config> {
    /// Unique identifier
    pub id: T::Hash,
    /// IPFS Content Identifier
    pub cid: BoundedVec<u8, T::MaxCidLength>,
    /// Encrypted symmetric key
    pub encrypted_key: BoundedVec<u8, T::MaxKeyLength>,
    /// Timestamp when created
    pub timestamp: T::Moment,
    /// Source platform
    pub source: ContentSource,
    /// Optional metadata
    pub metadata: BoundedVec<u8, T::MaxMetadataLength>,
    /// Soft delete flag
    pub deleted: bool,
}

/// Consent record for automated syncing
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct ConsentRecord<T: Config> {
    /// When consent was granted
    pub granted_at: T::Moment,
    /// Optional expiry time
    pub expires_at: Option<T::Moment>,
    /// Consent message hash
    pub message_hash: T::Hash,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Configure the pallet by specifying the parameters and types on which it depends.
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching event type (removed as it's automatically added)
        // type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Currency type for potential fees
        type Currency: Currency<Self::AccountId>;

        /// Time provider
        type Time: Time<Moment = Self::Moment>;

        /// Moment type for timestamps
        type Moment: Parameter + Default + Copy + MaxEncodedLen + Saturating + TypeInfo + PartialOrd;

        /// Maximum length of IPFS CID
        #[pallet::constant]
        type MaxCidLength: Get<u32>;

        /// Maximum length of encrypted key
        #[pallet::constant]
        type MaxKeyLength: Get<u32>;

        /// Maximum length of metadata
        #[pallet::constant]
        type MaxMetadataLength: Get<u32>;

        /// Maximum shadow items per account
        #[pallet::constant]
        type MaxItemsPerAccount: Get<u32>;
    }

    /// Storage for shadow items mapped by account
    #[pallet::storage]
    #[pallet::getter(fn shadow_items)]
    pub type ShadowItems<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<ShadowItem<T>, T::MaxItemsPerAccount>,
        ValueQuery,
    >;

    /// Storage for consent records
    #[pallet::storage]
    #[pallet::getter(fn consent_records)]
    pub type ConsentRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        ConsentRecord<T>,
        OptionQuery,
    >;

    /// Total count of shadow items per account
    #[pallet::storage]
    #[pallet::getter(fn item_count)]
    pub type ItemCount<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        u32,
        ValueQuery,
    >;

    /// Events emitted by the pallet
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Shadow item stored successfully
        ShadowItemStored {
            account: T::AccountId,
            id: T::Hash,
            cid: Vec<u8>,
            source: ContentSource,
        },

        /// Shadow item deleted
        ShadowItemDeleted {
            account: T::AccountId,
            id: T::Hash,
        },

        /// Consent granted for automated syncing
        ConsentGranted {
            account: T::AccountId,
            message_hash: T::Hash,
            expires_at: Option<T::Moment>,
        },

        /// Consent revoked
        ConsentRevoked {
            account: T::AccountId,
        },
    }

    /// Errors that can occur in the pallet
    #[pallet::error]
    pub enum Error<T> {
        /// CID is too long
        CidTooLong,
        /// Encrypted key is too long
        KeyTooLong,
        /// Metadata is too long
        MetadataTooLong,
        /// Account has reached maximum items limit
        TooManyItems,
        /// Item not found
        ItemNotFound,
        /// Consent not found
        ConsentNotFound,
        /// Consent has expired
        ConsentExpired,
    }

    /// Pallet dispatchable functions
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Submit a new shadow item
        ///
        /// The dispatch origin must be signed by the account claiming ownership.
        ///
        /// Parameters:
        /// - `cid`: IPFS Content Identifier
        /// - `encrypted_key`: Encrypted symmetric key
        /// - `source`: Content source (GitHub or Twitter)
        /// - `metadata`: Optional metadata
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000, 0).saturating_add(T::DbWeight::get().reads_writes(2, 2)))]
        pub fn submit_shadow_item(
            origin: OriginFor<T>,
            cid: Vec<u8>,
            encrypted_key: Vec<u8>,
            source: ContentSource,
            metadata: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Validate inputs
            let cid_bounded: BoundedVec<u8, T::MaxCidLength> = cid
                .try_into()
                .map_err(|_| Error::<T>::CidTooLong)?;
            
            let key_bounded: BoundedVec<u8, T::MaxKeyLength> = encrypted_key
                .try_into()
                .map_err(|_| Error::<T>::KeyTooLong)?;
            
            let metadata_bounded: BoundedVec<u8, T::MaxMetadataLength> = metadata
                .try_into()
                .map_err(|_| Error::<T>::MetadataTooLong)?;

            // Generate unique ID
            let nonce = ItemCount::<T>::get(&who);
            let id = T::Hashing::hash_of(&(&who, nonce, &cid_bounded));

            // Create shadow item
            let item = ShadowItem::<T> {
                id,
                cid: cid_bounded.clone(),
                encrypted_key: key_bounded,
                timestamp: T::Time::now(),
                source: source.clone(),
                metadata: metadata_bounded,
                deleted: false,
            };

            // Store item
            ShadowItems::<T>::try_mutate(&who, |items| -> DispatchResult {
                items.try_push(item).map_err(|_| Error::<T>::TooManyItems)?;
                Ok(())
            })?;

            // Increment counter
            ItemCount::<T>::mutate(&who, |count| *count = count.saturating_add(1));

            // Emit event
            Self::deposit_event(Event::ShadowItemStored {
                account: who,
                id,
                cid: cid_bounded.into_inner(),
                source,
            });

            Ok(())
        }

        /// Soft-delete a shadow item
        ///
        /// The dispatch origin must be signed by the item owner.
        ///
        /// Parameters:
        /// - `item_id`: The ID of the item to delete
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(10_000, 0).saturating_add(T::DbWeight::get().reads_writes(1, 1)))]
        pub fn delete_shadow_item(
            origin: OriginFor<T>,
            item_id: T::Hash,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Find and mark item as deleted
            ShadowItems::<T>::try_mutate(&who, |items| -> DispatchResult {
                let item = items
                    .iter_mut()
                    .find(|i| i.id == item_id)
                    .ok_or(Error::<T>::ItemNotFound)?;
                
                item.deleted = true;
                Ok(())
            })?;

            // Emit event
            Self::deposit_event(Event::ShadowItemDeleted {
                account: who,
                id: item_id,
            });

            Ok(())
        }

        /// Grant consent for automated syncing
        ///
        /// The dispatch origin must be signed.
        ///
        /// Parameters:
        /// - `message_hash`: Hash of the consent message
        /// - `expires_in`: Optional duration until expiry (in moments)
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(10_000, 0).saturating_add(T::DbWeight::get().writes(1)))]
        pub fn grant_consent(
            origin: OriginFor<T>,
            message_hash: T::Hash,
            expires_in: Option<T::Moment>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let now = T::Time::now();
            let expires_at = expires_in.map(|duration| now.saturating_add(duration));

            let consent = ConsentRecord::<T> {
                granted_at: now,
                expires_at,
                message_hash,
            };

            ConsentRecords::<T>::insert(&who, consent);

            // Emit event
            Self::deposit_event(Event::ConsentGranted {
                account: who,
                message_hash,
                expires_at,
            });

            Ok(())
        }

        /// Revoke consent for automated syncing
        ///
        /// The dispatch origin must be signed.
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(10_000, 0).saturating_add(T::DbWeight::get().writes(1)))]
        pub fn revoke_consent(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ConsentRecords::<T>::take(&who).ok_or(Error::<T>::ConsentNotFound)?;

            // Emit event
            Self::deposit_event(Event::ConsentRevoked { account: who });

            Ok(())
        }
    }

    /// Pallet helper functions
    impl<T: Config> Pallet<T> {
        /// Check if an account has valid consent
        pub fn has_valid_consent(account: &T::AccountId) -> bool {
            if let Some(consent) = ConsentRecords::<T>::get(account) {
                if let Some(expires_at) = consent.expires_at {
                    T::Time::now() <= expires_at
                } else {
                    true
                }
            } else {
                false
            }
        }

        /// Get shadow items for an account (excluding deleted)
        pub fn get_active_items(account: &T::AccountId) -> Vec<ShadowItem<T>> {
            ShadowItems::<T>::get(account)
                .into_iter()
                .filter(|item| !item.deleted)
                .collect()
        }
    }
}