import sys
sys.path.insert(0, '..')
from test import suggest_opponents, list_some_ids

print("=" * 60)
print("TEST: Fighter Matchmaking System")
print("=" * 60)

# Get sample fighters
sample_ids = list_some_ids(10)
print(f"\nAvailable fighters (sample): {', '.join(sample_ids)}\n")

# Test with bazooka
fighter_to_test = "bazooka"
print(f"Testing matchmaking for: {fighter_to_test}")
print("-" * 60)

base, suggestions = suggest_opponents(fighter_to_test, limit=5)

if not base:
    print(f"❌ Fighter '{fighter_to_test}' not found in database")
else:
    print(f"\n✅ Base Fighter Found:")
    print(f"   ID: {base['id']}")
    print(f"   Name: {base['name']}")
    print(f"   Nickname: {base.get('nickname', 'N/A')}")
    print(f"   Weight Class: {base.get('weight_class', 'Unknown')}")
    print(f"   Record: {base['wins']}-{base['losses']}-{base['draws']} (KO {base['kos']})")
    print(f"   Win Rate: {base['win_rate']:.1%}")
    print(f"   Total Fights: {base['total_fights']}")
    print(f"   Last Fight: {base.get('last_date', 'Unknown')}")
    print(f"   Country: {base.get('country', 'N/A')}")
    print(f"   State: {base.get('state_label', 'N/A')}")
    
    if suggestions:
        print(f"\n✅ Top {len(suggestions)} Suggested Opponents:")
        for i, s in enumerate(suggestions, 1):
            print(f"\n   {i}. {s['name']} (ID: {s['id']}) - Score: {s['score']}/100")
            print(f"      Record: {s['record']}")
            print(f"      Location: {s['country']} {s['state']}".strip())
            print(f"      Reasons: {', '.join(s['reasons'])}")
            if s['warnings']:
                print(f"      ⚠ Warnings: {', '.join(s['warnings'])}")
    else:
        print(f"\n⚠ No suggestions found for this weight class")

print("\n" + "=" * 60)
print("Conclusion: test.py IS CONNECTED to your project!")
print("=" * 60)
