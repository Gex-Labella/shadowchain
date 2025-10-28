//! Tests for the Shadow pallet.

use crate::{mock::*, Error, Event, ShadowItems, ConsentRecords};
use frame_support::{assert_noop, assert_ok};
use polkadot_sdk::polkadot_sdk_frame::deps::sp_runtime::traits::Hash;

#[test]
fn grant_consent_works() {
	new_test_ext().execute_with(|| {
		let account = 1;
		let message_hash = b"consent_message_hash".to_vec();
		let duration = Some(100);
		
		// Grant consent
		assert_ok!(ShadowPallet::grant_consent(
			RuntimeOrigin::signed(account),
			message_hash.clone(),
			duration
		));
		
		// Check storage
		let consent = ConsentRecords::<Test>::get(account).unwrap();
		assert_eq!(consent.message_hash, message_hash);
		assert_eq!(consent.granted_at, 1); // Block number is 1 in mock
		assert_eq!(consent.expires_at, Some(101)); // 1 + 100
		
		// Check event
		System::assert_has_event(
			Event::ConsentGranted { who: account, message_hash }.into()
		);
	});
}

#[test]
fn revoke_consent_works() {
	new_test_ext().execute_with(|| {
		let account = 1;
		let message_hash = b"consent_message_hash".to_vec();
		
		// First grant consent
		assert_ok!(ShadowPallet::grant_consent(
			RuntimeOrigin::signed(account),
			message_hash,
			None
		));
		
		// Revoke consent
		assert_ok!(ShadowPallet::revoke_consent(
			RuntimeOrigin::signed(account)
		));
		
		// Check storage
		assert!(ConsentRecords::<Test>::get(account).is_none());
		
		// Check event
		System::assert_has_event(
			Event::ConsentRevoked { who: account }.into()
		);
	});
}

#[test]
fn submit_shadow_item_requires_consent() {
	new_test_ext().execute_with(|| {
		let account = 1;
		let cid = b"QmTest".to_vec();
		let encrypted_key = b"encrypted_key".to_vec();
		let metadata = b"test metadata".to_vec();
		
		// Try to submit without consent
		assert_noop!(
			ShadowPallet::submit_shadow_item(
				RuntimeOrigin::signed(account),
				cid.clone(),
				encrypted_key.clone(),
				0,
				metadata.clone()
			),
			Error::<Test>::NoConsent
		);
		
		// Grant consent
		assert_ok!(ShadowPallet::grant_consent(
			RuntimeOrigin::signed(account),
			b"consent".to_vec(),
			None
		));
		
		// Now submit should work
		assert_ok!(ShadowPallet::submit_shadow_item(
			RuntimeOrigin::signed(account),
			cid.clone(),
			encrypted_key.clone(),
			0, // GitHub source
			metadata.clone()
		));
	});
}

#[test]
fn expired_consent_fails() {
	new_test_ext().execute_with(|| {
		let account = 1;
		
		// Grant consent with short duration
		assert_ok!(ShadowPallet::grant_consent(
			RuntimeOrigin::signed(account),
			b"consent".to_vec(),
			Some(1) // Expires after 1 block
		));
		
		// Advance block
		System::set_block_number(3);
		
		// Try to submit - should fail due to expired consent
		assert_noop!(
			ShadowPallet::submit_shadow_item(
				RuntimeOrigin::signed(account),
				b"cid".to_vec(),
				b"key".to_vec(),
				0,
				b"meta".to_vec()
			),
			Error::<Test>::ConsentExpired
		);
	});
}

#[test]
fn submit_shadow_item_validates_inputs() {
	new_test_ext().execute_with(|| {
		let account = 1;
		
		// CID too long
		assert_noop!(
			ShadowPallet::submit_shadow_item(
				RuntimeOrigin::signed(account),
				vec![0u8; 101], // Too long
				b"key".to_vec(),
				0,
				b"meta".to_vec()
			),
			Error::<Test>::CidTooLong
		);
		
		// Key too long  
		assert_noop!(
			ShadowPallet::submit_shadow_item(
				RuntimeOrigin::signed(account),
				b"cid".to_vec(),
				vec![0u8; 513], // Too long
				0,
				b"meta".to_vec()
			),
			Error::<Test>::KeyTooLong
		);
		
		// Metadata too long
		assert_noop!(
			ShadowPallet::submit_shadow_item(
				RuntimeOrigin::signed(account),
				b"cid".to_vec(),
				b"key".to_vec(),
				0,
				vec![0u8; 257] // Too long
			),
			Error::<Test>::MetadataTooLong
		);
		
		// Invalid source
		assert_noop!(
			ShadowPallet::submit_shadow_item(
				RuntimeOrigin::signed(account),
				b"cid".to_vec(),
				b"key".to_vec(),
				2, // Invalid source
				b"meta".to_vec()
			),
			Error::<Test>::InvalidSource
		);
	});
}

#[test]
fn delete_shadow_item_works() {
	new_test_ext().execute_with(|| {
		let account = 1;
		let cid = b"QmTest".to_vec();
		
		// Submit shadow item
		assert_ok!(ShadowPallet::submit_shadow_item(
			RuntimeOrigin::signed(account),
			cid.clone(),
			b"key".to_vec(),
			1, // Twitter source
			b"meta".to_vec()
		));
		
		// Get the item ID
		let items = ShadowItems::<Test>::get(account);
		let item_id = <Test as frame_system::Config>::Hashing::hash_of(&(&account, &0u32, &cid));
		
		// Delete the item
		assert_ok!(ShadowPallet::delete_shadow_item(
			RuntimeOrigin::signed(account),
			item_id
		));
		
		// Check storage
		let items_after = ShadowItems::<Test>::get(account);
		assert_eq!(items_after.len(), 0);
		
		// Check event
		System::assert_has_event(
			Event::ShadowItemDeleted { who: account, item_id }.into()
		);
	});
}

#[test]
fn multiple_items_per_account_works() {
	new_test_ext().execute_with(|| {
		let account = 1;
		
		// Grant consent first
		assert_ok!(ShadowPallet::grant_consent(
			RuntimeOrigin::signed(account),
			b"consent".to_vec(),
			None
		));
		
		// Submit multiple items
		for i in 0..5 {
			let cid = format!("Qm{}", i).into_bytes();
			assert_ok!(ShadowPallet::submit_shadow_item(
				RuntimeOrigin::signed(account),
				cid,
				b"key".to_vec(),
				i % 2, // Alternate between GitHub and Twitter
				format!("meta{}", i).into_bytes()
			));
		}
		
		// Check storage
		let items = ShadowItems::<Test>::get(account);
		assert_eq!(items.len(), 5);
	});
}