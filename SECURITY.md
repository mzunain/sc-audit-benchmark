# Security Policy

## Reporting a Vulnerability

Please report security issues privately by emailing
ranamzulqarnain1@gmail.com. Do not open a public issue for exploitable
vulnerabilities in the dashboard, API routes, benchmark pipeline, or generated
contract handling.

Include:

- affected component or route
- reproduction steps
- expected impact
- relevant logs, payloads, or screenshots

I will acknowledge reports as quickly as possible and coordinate a fix before
public disclosure when the issue is confirmed.

## Scope

Security reports are in scope for:

- dashboard API routes and playground request handling
- benchmark pipeline code
- dependency or CI configuration issues
- unsafe generated-contract execution paths

Generated vulnerable Solidity contracts are intentionally insecure benchmark
fixtures. Reports about the expected benchmark vulnerabilities should use the
normal issue templates instead.
