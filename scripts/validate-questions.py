"""CI schema validation plus constraints involving multiple fields."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker
root = Path(__file__).resolve().parents[1]
schema = json.loads((root / 'questions/schema.json').read_text())
validator = Draft202012Validator(schema, format_checker=FormatChecker())
for path in sorted((root / 'questions').glob('*.json')):
    if path.name == 'schema.json':
        continue
    questions = json.loads(path.read_text())
    validator.validate(questions)
    ids = set()
    for q in questions:
        assert q['id'] not in ids, f"{path}: duplicate ID {q['id']}"
        ids.add(q['id'])
        assert q['correct'] < len(q['answers']), f"{path}: correct is outside answers"
    print(f'{path.name}: {len(questions)} valid questions')
# Translations must have the same keys and questions must have matching IDs.
ru, en = [json.loads((root / f'i18n/{lang}.json').read_text()) for lang in ('ru','en')]
assert ru.keys() == en.keys(), 'Missing UI translation'
ruq, enq = [json.loads((root / f'questions/{lang}.json').read_text()) for lang in ('ru','en')]
assert [q['id'] for q in ruq] == [q['id'] for q in enq], 'Question translation IDs differ'
