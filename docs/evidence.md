# Grove on-chain evidence

Synthetic seed only. Project `grove-c3d9f553`.

```json
{
  "project": "grove-c3d9f553",
  "vaultId": "vault-43fda199",
  "owner": "0x811E77Fe50710984108648D0e101C37a5F435816",
  "seededAt": "2026-10-18T14:30:46.015Z",
  "scenarios": [
    {
      "id": "F",
      "description": "Endorsed note",
      "expect": "allow endorsed",
      "nid": "b81d18c6bbfd8268",
      "entityKey": "0xd1fc53224b6aba05526a33b4b2307419d58c642d243b4f31b987beec303efccd",
      "txHashes": [
        "0xe3938dbbc3a7ac1d6ce084eede9f345266db3b2963b79f8cf725753d18de8e35",
        "0x19187f323aac5b002cb83f9c500797d5569540273d36c2ad665d2082d0657dcd"
      ],
      "verdict": {
        "allow": true,
        "reason": "ok",
        "label": "endorsed"
      }
    },
    {
      "id": "A",
      "description": "Rogue key-holder injection",
      "expect": "creator_not_allowlisted",
      "nid": "964c45120ab50609",
      "entityKey": "0x0eb05a16435140a91793069b57555ffb59bdf599416d31a7edba68acce4b960d",
      "txHashes": [
        "0xf5ef353c53db4544a9ddfac6a6c8ffffa9fd54de9da44c2d54b8a47582d9914b"
      ],
      "verdict": {
        "allow": false,
        "reason": "creator_not_allowlisted",
        "label": "none"
      }
    },
    {
      "id": "B",
      "description": "Allowlisted new agent, no endorsement",
      "expect": "pending_review",
      "nid": "5ce98c35ffe34237",
      "entityKey": "0x75c51bae471176043f889d1d3e07718143f6775362a53f51ece97606d82fa522",
      "txHashes": [
        "0x64026dc6b053982d00784e0f58e59d525f808d6d68009e862bc4010b125f5270",
        "0xd3431f65ad88075c2a33f95ebcd70e47294a94e4edddaa5104ba7afb1b52b55b"
      ],
      "verdict": {
        "allow": false,
        "reason": "pending_review",
        "label": "none"
      }
    },
    {
      "id": "C",
      "description": "Replayed nid with different content",
      "expect": "content_differs_from_endorsed_hash",
      "nid": "b81d18c6bbfd8268",
      "entityKey": "0xf5c5f3b16099dd35f427fb9521cfa0acba1a51035470f4238ef5595fa9dab027",
      "txHashes": [
        "0xd311d29e7a1be72178e48c0a4627007194b1e112f45dc9a066bd30ab37e4a601"
      ],
      "verdict": {
        "allow": false,
        "reason": "content_differs_from_endorsed_hash",
        "label": "none"
      }
    },
    {
      "id": "D",
      "description": "Handoff skipped",
      "expect": "handoff_incomplete",
      "nid": "555765e5ccb3aba9",
      "entityKey": "0xc89b76092fd646767e791038e035ec1482c8f9639821381cc8d604ab067b8760",
      "txHashes": [
        "0xa98b28af29f4669773cf17dce710b78e9469e99680c959d27b650cbe05439ced"
      ],
      "verdict": {
        "allow": false,
        "reason": "handoff_incomplete",
        "label": "none"
      }
    },
    {
      "id": "E",
      "description": "Unsealed plaintext payload",
      "expect": "not_sealed",
      "nid": "550166739d58a54b",
      "entityKey": "0xf1347c7a5c6325c87b2989ba4ccd853441c62c695042a6842e6ceab40b8f4d7c",
      "txHashes": [
        "0xfb442248576b11450664c1e04b902efb037d58b45cedfd0a32d3190228dcb8cb"
      ],
      "verdict": {
        "allow": false,
        "reason": "not_sealed",
        "label": "none"
      }
    },
    {
      "id": "G",
      "description": "Trusted agent, unreviewed",
      "expect": "allow agent_trusted_unreviewed (reject if strict)",
      "nid": "ae019bee76ae40b9",
      "entityKey": "0xb25b7598c49685b9a3ac939b4c689b7f2a89d810be20b7f68c151021d3d96091",
      "txHashes": [
        "0x8ab0e8032b9bc88e1c214c8a000d94a58f70ad0a4f2b5eb70beff055d249b5d2",
        "0x7a6f008c06c717bde69add191d8b54c19c691e02fbd0cbbee9274e53c1abeb7a"
      ],
      "verdict": {
        "allow": true,
        "reason": "ok",
        "label": "agent_trusted_unreviewed"
      }
    }
  ]
}
```
