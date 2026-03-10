# PolyForge Security Rules

## Secrets
1. Credentials, API keys, and tokens live in environment variables
2. Example env files (`.env.example`) use placeholder values only

## Input Validation
3. All user input is validated at system boundaries (controllers, API handlers)
4. Shell commands use argument arrays, not string concatenation with user input

## Authentication & Authorization
5. Every endpoint that modifies data requires authentication
6. Authorization checks happen at the service layer, not just the controller
7. Sensitive operations require re-authentication or confirmation

## Data Protection
8. Sensitive data is excluded from logs and error messages
9. API responses include only the fields the consumer needs
