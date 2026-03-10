# PolyForge Testing Rules

## Structure
1. Test names describe behavior: "it should {expected} when {condition}"
2. Each test verifies one behavior
3. Test data uses factories or fixtures, not hardcoded magic values

## Coverage
4. Every public method in a service has at least one test
5. Critical paths (auth, payments, data mutations) have thorough test coverage

## Quality
6. Tests that pass without the implementation being correct are rewritten
7. Time-dependent tests use frozen clocks; order-dependent tests use explicit setup
