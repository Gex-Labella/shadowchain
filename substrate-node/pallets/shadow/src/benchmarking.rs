//! Benchmarking setup for pallet-shadow

use super::*;

#[allow(unused)]
use crate::Pallet as Shadow;
use frame_benchmarking::{benchmarks, whitelisted_caller};
use frame_system::RawOrigin;
use polkadot_sdk::polkadot_sdk_frame::deps::sp_runtime::traits::Hash;

benchmarks! {
	submit_shadow_item {
		let caller: T::AccountId = whitelisted_caller();
		let cid = b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG".to_vec();
		let encrypted_key = vec![0u8; 256];
		let metadata = b"benchmark metadata".to_vec();
	}: _(RawOrigin::Signed(caller.clone()), cid.clone(), encrypted_key, 0, metadata)
	verify {
		let items = ShadowItems::<T>::get(&caller);
		assert_eq!(items.len(), 1);
		assert_eq!(items[0].cid, cid);
	}

	delete_shadow_item {
		let caller: T::AccountId = whitelisted_caller();
		let cid = b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG".to_vec();
		let encrypted_key = vec![0u8; 256];
		let metadata = b"benchmark metadata".to_vec();
		
		// First submit an item
		Shadow::<T>::submit_shadow_item(
			RawOrigin::Signed(caller.clone()).into(),
			cid.clone(),
			encrypted_key,
			0,
			metadata,
		)?;
		
		// Get the item ID
		let nonce = 0u32;
		let item_id = T::Hashing::hash_of(&(&caller, &nonce, &cid));
		
	}: _(RawOrigin::Signed(caller.clone()), item_id)
	verify {
		let items = ShadowItems::<T>::get(&caller);
		assert_eq!(items.len(), 0);
	}

	impl_benchmark_test_suite!(Shadow, crate::mock::new_test_ext(), crate::mock::Test);
}