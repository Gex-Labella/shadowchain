//! Unit tests for the Shadow pallet

use super::*;
use crate::{mock::*, Error, Event};
use frame_support::{assert_noop, assert_ok};
use sp_runtime::traits::Hash;

#[test]
fn submit_shadow_item_works() {
    new_test_ext().execute_with(|| {
        // Test data
        let account = 1;
        let cid = b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG".to_vec();
        let encrypted_key = b"encrypted_symmetric_key_data".to_vec();
        let metadata = b"test metadata".to_vec();

        // Submit shadow item
        assert_ok!(ShadowPallet::submit_shadow_item(
            RuntimeOrigin::signed(account),
            cid.clone(),
            encrypted_key.clone(),
            0, // 0 for GitHub
            metadata.clone()
        ));

        // Check storage
        let items = ShadowPallet::shadow_items(account);
        assert_eq!(items.len(), 1);
        
        let item = &items[0];
        assert_eq!(item.cid.to_vec(), cid);
        assert_eq!(item.encrypted_key.to_vec(), encrypted_key);
        assert_eq!(item.source, ContentSource::GitHub);
        assert_eq!(item.metadata.to_vec(), metadata);
        assert_eq!(item.deleted, false);

        // Check item count
        assert_eq!(ShadowPallet::item_count(account), 1);

        // Check event
        System::assert_last_event(
            Event::ShadowItemStored {
                account,
                id: item.id,
                cid: cid.clone(),
                source: 0, // 0 for GitHub
            }
            .into(),
        );
    });
}

#[test]
fn submit_multiple_items_works() {
    new_test_ext().execute_with(|| {
        let account = 1;

        // Submit first item
        assert_ok!(ShadowPallet::submit_shadow_item(
            RuntimeOrigin::signed(account),
            b"CID1".to_vec(),
            b"key1".to_vec(),
            0, // GitHub
            vec![]
        ));

        // Submit second item
        assert_ok!(ShadowPallet::submit_shadow_item(
            RuntimeOrigin::signed(account),
            b"CID2".to_vec(),
            b"key2".to_vec(),
            1, // Twitter
            vec![]
        ));

        // Check storage
        let items = ShadowPallet::shadow_items(account);
        assert_eq!(items.len(), 2);
        assert_eq!(ShadowPallet::item_count(account), 2);
    });
}

#[test]
fn submit_shadow_item_cid_too_long() {
    new_test_ext().execute_with(|| {
        let account = 1;
        let long_cid = vec![0u8; 101]; // Exceeds MaxCidLength

        assert_noop!(
            ShadowPallet::submit_shadow_item(
                RuntimeOrigin::signed(account),
                long_cid,
                b"key".to_vec(),
                0, // GitHub
                vec![]
            ),
            Error::<Test>::CidTooLong
        );
    });
}

#[test]
fn submit_shadow_item_key_too_long() {
    new_test_ext().execute_with(|| {
        let account = 1;
        let long_key = vec![0u8; 513]; // Exceeds MaxKeyLength

        assert_noop!(
            ShadowPallet::submit_shadow_item(
                RuntimeOrigin::signed(account),
                b"CID".to_vec(),
                long_key,
                0, // GitHub
                vec![]
            ),
            Error::<Test>::KeyTooLong
        );
    });
}

#[test]
fn submit_shadow_item_metadata_too_long() {
    new_test_ext().execute_with(|| {
        let account = 1;
        let long_metadata = vec![0u8; 257]; // Exceeds MaxMetadataLength

        assert_noop!(
            ShadowPallet::submit_shadow_item(
                RuntimeOrigin::signed(account),
                b"CID".to_vec(),
                b"key".to_vec(),
                0, // GitHub
                long_metadata
            ),
            Error::<Test>::MetadataTooLong
        );
    });
}

#[test]
fn delete_shadow_item_works() {
    new_test_ext().execute_with(|| {
        let account = 1;

        // Submit item first
        assert_ok!(ShadowPallet::submit_shadow_item(
            RuntimeOrigin::signed(account),
            b"CID".to_vec(),
            b"key".to_vec(),
            0, // GitHub
            vec![]
        ));

        // Get the item ID
        let item_id = ShadowPallet::shadow_items(account)[0].id;

        // Delete the item
        assert_ok!(ShadowPallet::delete_shadow_item(
            RuntimeOrigin::signed(account),
            item_id
        ));

        // Check item is marked as deleted
        let items = ShadowPallet::shadow_items(account);
        assert_eq!(items[0].deleted, true);

        // Check event
        System::assert_last_event(
            Event::ShadowItemDeleted {
                account,
                id: item_id,
            }
            .into(),
        );
    });
}

#[test]
fn delete_nonexistent_item_fails() {
    new_test_ext().execute_with(|| {
        let account = 1;
        let fake_id = <Test as frame_system::Config>::Hashing::hash(b"fake");

        assert_noop!(
            ShadowPallet::delete_shadow_item(RuntimeOrigin::signed(account), fake_id),
            Error::<Test>::ItemNotFound
        );
    });
}

#[test]
fn delete_other_users_item_fails() {
    new_test_ext().execute_with(|| {
        let account1 = 1;
        let account2 = 2;

        // Account 1 submits item
        assert_ok!(ShadowPallet::submit_shadow_item(
            RuntimeOrigin::signed(account1),
            b"CID".to_vec(),
            b"key".to_vec(),
            0, // GitHub
            vec![]
        ));

        let item_id = ShadowPallet::shadow_items(account1)[0].id;

        // Account 2 tries to delete it
        assert_noop!(
            ShadowPallet::delete_shadow_item(RuntimeOrigin::signed(account2), item_id),
            Error::<Test>::ItemNotFound
        );
    });
}

#[test]
fn grant_consent_works() {
    new_test_ext().execute_with(|| {
        let account = 1;
        let message_hash = <Test as frame_system::Config>::Hashing::hash(b"consent message");

        // Grant consent without expiry
        assert_ok!(ShadowPallet::grant_consent(
            RuntimeOrigin::signed(account),
            message_hash,
            None
        ));

        // Check storage
        let consent = ShadowPallet::consent_records(account).unwrap();
        assert_eq!(consent.message_hash, message_hash);
        assert_eq!(consent.expires_at, None);

        // Check event
        System::assert_last_event(
            Event::ConsentGranted {
                account,
                message_hash,
                expires_at: None,
            }
            .into(),
        );

        // Check has_valid_consent
        assert!(ShadowPallet::has_valid_consent(&account));
    });
}

#[test]
fn grant_consent_with_expiry_works() {
    new_test_ext().execute_with(|| {
        let account = 1;
        let message_hash = <Test as frame_system::Config>::Hashing::hash(b"consent message");
        let expires_in = 3600; // 1 hour in seconds/moments

        // Grant consent with expiry
        assert_ok!(ShadowPallet::grant_consent(
            RuntimeOrigin::signed(account),
            message_hash,
            Some(expires_in)
        ));

        // Check storage
        let consent = ShadowPallet::consent_records(account).unwrap();
        assert_eq!(consent.expires_at, Some(6000 + expires_in));

        // Check validity
        assert!(ShadowPallet::has_valid_consent(&account));

        // Fast forward past expiry
        Timestamp::set_timestamp(6000 + expires_in + 1);
        assert!(!ShadowPallet::has_valid_consent(&account));
    });
}

#[test]
fn revoke_consent_works() {
    new_test_ext().execute_with(|| {
        let account = 1;
        let message_hash = <Test as frame_system::Config>::Hashing::hash(b"consent message");

        // Grant consent first
        assert_ok!(ShadowPallet::grant_consent(
            RuntimeOrigin::signed(account),
            message_hash,
            None
        ));

        // Revoke consent
        assert_ok!(ShadowPallet::revoke_consent(RuntimeOrigin::signed(account)));

        // Check storage
        assert_eq!(ShadowPallet::consent_records(account), None);

        // Check event
        System::assert_last_event(Event::ConsentRevoked { account }.into());

        // Check validity
        assert!(!ShadowPallet::has_valid_consent(&account));
    });
}

#[test]
fn revoke_nonexistent_consent_fails() {
    new_test_ext().execute_with(|| {
        let account = 1;

        assert_noop!(
            ShadowPallet::revoke_consent(RuntimeOrigin::signed(account)),
            Error::<Test>::ConsentNotFound
        );
    });
}

#[test]
fn get_active_items_excludes_deleted() {
    new_test_ext().execute_with(|| {
        let account = 1;

        // Submit two items
        assert_ok!(ShadowPallet::submit_shadow_item(
            RuntimeOrigin::signed(account),
            b"CID1".to_vec(),
            b"key1".to_vec(),
            0, // GitHub
            vec![]
        ));

        assert_ok!(ShadowPallet::submit_shadow_item(
            RuntimeOrigin::signed(account),
            b"CID2".to_vec(),
            b"key2".to_vec(),
            1, // Twitter
            vec![]
        ));

        // Delete first item
        let item_id = ShadowPallet::shadow_items(account)[0].id;
        assert_ok!(ShadowPallet::delete_shadow_item(
            RuntimeOrigin::signed(account),
            item_id
        ));

        // Get active items
        let active_items = ShadowPallet::get_active_items(&account);
        assert_eq!(active_items.len(), 1);
        assert_eq!(active_items[0].cid.to_vec(), b"CID2".to_vec());
    });
}

#[test]
fn unique_item_ids_generated() {
    new_test_ext().execute_with(|| {
        let account = 1;

        // Submit multiple items with same CID
        for i in 0..5 {
            assert_ok!(ShadowPallet::submit_shadow_item(
                RuntimeOrigin::signed(account),
                b"SameCID".to_vec(),
                format!("key{}", i).as_bytes().to_vec(),
                0, // GitHub
                vec![]
            ));
        }

        // Check all IDs are unique
        let items = ShadowPallet::shadow_items(account);
        let mut ids: Vec<_> = items.iter().map(|i| i.id).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 5);
    });
}