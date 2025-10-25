//! Benchmarking setup for pallet-shadow

use super::*;
use frame_benchmarking::{benchmarks, whitelisted_caller, account};
use frame_system::RawOrigin;
use sp_std::vec;

benchmarks! {
    submit_shadow_item {
        let caller: T::AccountId = whitelisted_caller();
        let cid = vec![1u8; 46]; // Typical IPFS CID length
        let encrypted_key = vec![2u8; 256]; // Typical encrypted key length
        let metadata = vec![3u8; 100]; // Some metadata
    }: _(RawOrigin::Signed(caller.clone()), cid.clone(), encrypted_key, ContentSource::GitHub, metadata)
    verify {
        assert_eq!(ItemCount::<T>::get(&caller), 1);
    }

    delete_shadow_item {
        let caller: T::AccountId = whitelisted_caller();
        
        // First submit an item
        let cid = vec![1u8; 46];
        let encrypted_key = vec![2u8; 256];
        let metadata = vec![3u8; 100];
        
        Pallet::<T>::submit_shadow_item(
            RawOrigin::Signed(caller.clone()).into(),
            cid,
            encrypted_key,
            ContentSource::GitHub,
            metadata
        )?;
        
        let item_id = ShadowItems::<T>::get(&caller)[0].id;
    }: _(RawOrigin::Signed(caller.clone()), item_id)
    verify {
        assert!(ShadowItems::<T>::get(&caller)[0].deleted);
    }

    grant_consent {
        let caller: T::AccountId = whitelisted_caller();
        let message_hash = T::Hashing::hash(b"consent message");
        let expires_in = Some(T::Moment::default());
    }: _(RawOrigin::Signed(caller.clone()), message_hash, expires_in)
    verify {
        assert!(ConsentRecords::<T>::contains_key(&caller));
    }

    revoke_consent {
        let caller: T::AccountId = whitelisted_caller();
        
        // First grant consent
        let message_hash = T::Hashing::hash(b"consent message");
        Pallet::<T>::grant_consent(
            RawOrigin::Signed(caller.clone()).into(),
            message_hash,
            None
        )?;
    }: _(RawOrigin::Signed(caller.clone()))
    verify {
        assert!(!ConsentRecords::<T>::contains_key(&caller));
    }

    impl_benchmark_test_suite!(Pallet, crate::mock::new_test_ext(), crate::mock::Test);
}