//! Benchmarking setup for pallet-shadow
#![cfg(feature = "runtime-benchmarks")]

use super::*;
use frame_benchmarking::v2::*;
use frame_system::RawOrigin;
use frame_support::traits::Get;

#[benchmarks]
mod benchmarks {
	use super::*;

	#[benchmark]
	fn submit_shadow_item() {
		let caller: T::AccountId = whitelisted_caller();
		
		// Grant consent first
		let message_hash = b"benchmark_consent".to_vec();
		let _ = Pallet::<T>::grant_consent(
			RawOrigin::Signed(caller.clone()).into(),
			message_hash,
			None,
		);

		let cid = vec![b'Q'; 46]; // Typical CID length
		let encrypted_key = vec![b'k'; 256]; // Typical key length
		let metadata = vec![b'm'; 128]; // Typical metadata length

		#[extrinsic_call]
		submit_shadow_item(
			RawOrigin::Signed(caller.clone()),
			cid.clone(),
			encrypted_key,
			0u8,
			metadata,
		);

		// Verify
		let items = ShadowItems::<T>::get(&caller);
		assert_eq!(items.len(), 1);
		assert_eq!(items[0].cid, cid);
	}

	#[benchmark]
	fn delete_shadow_item() {
		let caller: T::AccountId = whitelisted_caller();
		
		// Grant consent and add an item first
		let message_hash = b"benchmark_consent".to_vec();
		let _ = Pallet::<T>::grant_consent(
			RawOrigin::Signed(caller.clone()).into(),
			message_hash,
			None,
		);

		let cid = vec![b'Q'; 46];
		let encrypted_key = vec![b'k'; 256];
		let metadata = vec![b'm'; 128];

		let _ = Pallet::<T>::submit_shadow_item(
			RawOrigin::Signed(caller.clone()).into(),
			cid,
			encrypted_key,
			0u8,
			metadata,
		);

		let items = ShadowItems::<T>::get(&caller);
		let item_id = T::Hash::decode(&mut &items[0].id[..]).unwrap();

		#[extrinsic_call]
		delete_shadow_item(RawOrigin::Signed(caller.clone()), item_id);

		// Verify
		let items_after = ShadowItems::<T>::get(&caller);
		assert_eq!(items_after.len(), 0);
	}

	#[benchmark]
	fn grant_consent() {
		let caller: T::AccountId = whitelisted_caller();
		let message_hash = vec![b'h'; 32];
		let duration = Some(T::BlockNumber::from(100u32));

		#[extrinsic_call]
		grant_consent(RawOrigin::Signed(caller.clone()), message_hash.clone(), duration);

		// Verify
		let consent = ConsentRecords::<T>::get(&caller).unwrap();
		assert_eq!(consent.message_hash, message_hash);
	}

	#[benchmark]
	fn revoke_consent() {
		let caller: T::AccountId = whitelisted_caller();
		
		// Grant consent first
		let message_hash = b"benchmark_consent".to_vec();
		let _ = Pallet::<T>::grant_consent(
			RawOrigin::Signed(caller.clone()).into(),
			message_hash,
			None,
		);

		#[extrinsic_call]
		revoke_consent(RawOrigin::Signed(caller.clone()));

		// Verify
		assert!(ConsentRecords::<T>::get(&caller).is_none());
	}

	impl_benchmark_test_suite!(Pallet, crate::mock::new_test_ext(), crate::mock::Test);
}