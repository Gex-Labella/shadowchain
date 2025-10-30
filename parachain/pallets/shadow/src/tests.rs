//! Unit tests for the Shadow pallet.

use super::*;
use crate::{mock::*, Error, Event};
use frame_support::{assert_noop, assert_ok};

#[test]
fn submit_shadow_item_works() {
	new_test_ext().execute_with(|| {
		// Grant consent first
		assert_ok!(Shadow::grant_consent(
			RuntimeOrigin::signed(1),
			b"test_consent".to_vec(),
			None
		));

		// Submit shadow item
		assert_ok!(Shadow::submit_shadow_item(
			RuntimeOrigin::signed(1),
			b"QmTest123".to_vec(),
			b"encrypted_key_123".to_vec(),
			0, // GitHub source
			b"test metadata".to_vec()
		));

		// Check storage
		let items = ShadowItems::<Test>::get(1);
		assert_eq!(items.len(), 1);
		assert_eq!(items[0].cid, b"QmTest123".to_vec());
		assert_eq!(items[0].source, 0);

		// Check event
		System::assert_last_event(
			Event::ShadowItemStored {
				who: 1,
				item_id: items[0].id.clone().try_into().unwrap(),
				cid: b"QmTest123".to_vec(),
			}
			.into(),
		);
	});
}

#[test]
fn submit_shadow_item_fails_without_consent() {
	new_test_ext().execute_with(|| {
		// Try to submit without consent
		assert_noop!(
			Shadow::submit_shadow_item(
				RuntimeOrigin::signed(1),
				b"QmTest123".to_vec(),
				b"encrypted_key_123".to_vec(),
				0,
				b"test metadata".to_vec()
			),
			Error::<Test>::NoConsent
		);
	});
}

#[test]
fn submit_shadow_item_fails_with_invalid_source() {
	new_test_ext().execute_with(|| {
		// Grant consent
		assert_ok!(Shadow::grant_consent(
			RuntimeOrigin::signed(1),
			b"test_consent".to_vec(),
			None
		));

		// Try to submit with invalid source
		assert_noop!(
			Shadow::submit_shadow_item(
				RuntimeOrigin::signed(1),
				b"QmTest123".to_vec(),
				b"encrypted_key_123".to_vec(),
				5, // Invalid source
				b"test metadata".to_vec()
			),
			Error::<Test>::InvalidSource
		);
	});
}

#[test]
fn delete_shadow_item_works() {
	new_test_ext().execute_with(|| {
		// Grant consent and submit item
		assert_ok!(Shadow::grant_consent(
			RuntimeOrigin::signed(1),
			b"test_consent".to_vec(),
			None
		));
		assert_ok!(Shadow::submit_shadow_item(
			RuntimeOrigin::signed(1),
			b"QmTest123".to_vec(),
			b"encrypted_key_123".to_vec(),
			0,
			b"test metadata".to_vec()
		));

		// Get the item ID
		let items = ShadowItems::<Test>::get(1);
		let item_id: <Test as frame_system::Config>::Hash = items[0].id.clone().try_into().unwrap();

		// Delete the item
		assert_ok!(Shadow::delete_shadow_item(RuntimeOrigin::signed(1), item_id));

		// Check storage
		let items_after = ShadowItems::<Test>::get(1);
		assert_eq!(items_after.len(), 0);

		// Check event
		System::assert_last_event(Event::ShadowItemDeleted { who: 1, item_id }.into());
	});
}

#[test]
fn grant_consent_works() {
	new_test_ext().execute_with(|| {
		let message_hash = b"consent_message_hash".to_vec();

		// Grant consent
		assert_ok!(Shadow::grant_consent(
			RuntimeOrigin::signed(1),
			message_hash.clone(),
			Some(100)
		));

		// Check storage
		let consent = ConsentRecords::<Test>::get(1).unwrap();
		assert_eq!(consent.message_hash, message_hash);
		assert_eq!(consent.granted_at, 1);
		assert_eq!(consent.expires_at, Some(101));

		// Check event
		System::assert_last_event(Event::ConsentGranted { who: 1, message_hash }.into());
	});
}

#[test]
fn revoke_consent_works() {
	new_test_ext().execute_with(|| {
		// Grant consent first
		assert_ok!(Shadow::grant_consent(
			RuntimeOrigin::signed(1),
			b"test_consent".to_vec(),
			None
		));

		// Revoke consent
		assert_ok!(Shadow::revoke_consent(RuntimeOrigin::signed(1)));

		// Check storage
		assert!(ConsentRecords::<Test>::get(1).is_none());

		// Check event
		System::assert_last_event(Event::ConsentRevoked { who: 1 }.into());
	});
}

#[test]
fn consent_expiry_works() {
	new_test_ext().execute_with(|| {
		// Grant consent with expiry
		assert_ok!(Shadow::grant_consent(
			RuntimeOrigin::signed(1),
			b"test_consent".to_vec(),
			Some(10) // Expires after 10 blocks
		));

		// Should work at block 1
		assert_ok!(Shadow::submit_shadow_item(
			RuntimeOrigin::signed(1),
			b"QmTest123".to_vec(),
			b"encrypted_key_123".to_vec(),
			0,
			b"test metadata".to_vec()
		));

		// Move to block 12 (past expiry)
		System::set_block_number(12);

		// Should fail after expiry
		assert_noop!(
			Shadow::submit_shadow_item(
				RuntimeOrigin::signed(1),
				b"QmTest456".to_vec(),
				b"encrypted_key_456".to_vec(),
				0,
				b"test metadata 2".to_vec()
			),
			Error::<Test>::ConsentExpired
		);
	});
}

#[test]
fn cid_too_long_fails() {
	new_test_ext().execute_with(|| {
		// Grant consent
		assert_ok!(Shadow::grant_consent(
			RuntimeOrigin::signed(1),
			b"test_consent".to_vec(),
			None
		));

		// Create a CID that's too long (more than 100 bytes)
		let long_cid = vec![b'Q'; 101];

		assert_noop!(
			Shadow::submit_shadow_item(
				RuntimeOrigin::signed(1),
				long_cid,
				b"encrypted_key_123".to_vec(),
				0,
				b"test metadata".to_vec()
			),
			Error::<Test>::CidTooLong
		);
	});
}

#[test]
fn too_many_items_fails() {
	new_test_ext().execute_with(|| {
		// Grant consent
		assert_ok!(Shadow::grant_consent(
			RuntimeOrigin::signed(1),
			b"test_consent".to_vec(),
			None
		));

		// Submit max items (100)
		for i in 0..100 {
			assert_ok!(Shadow::submit_shadow_item(
				RuntimeOrigin::signed(1),
				format!("QmTest{}", i).as_bytes().to_vec(),
				b"encrypted_key".to_vec(),
				0,
				b"metadata".to_vec()
			));
		}

		// The 101st item should fail
		assert_noop!(
			Shadow::submit_shadow_item(
				RuntimeOrigin::signed(1),
				b"QmTest101".to_vec(),
				b"encrypted_key".to_vec(),
				0,
				b"metadata".to_vec()
			),
			Error::<Test>::TooManyItems
		);
	});
}