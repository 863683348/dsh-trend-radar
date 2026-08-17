# Security

- `dsh-trend-radar` reads public GitHub APIs only (topic search, awesome git tree) and writes local snapshot history to the configured `dataDir`.
- No credentials are read or stored by the plugin; an optional GitHub token is read from the environment variable named by `githubTokenEnv` and used only in the Authorization header of outbound requests.
- No shell execution, no file reads outside `dataDir`.

Report issues in this repository.
