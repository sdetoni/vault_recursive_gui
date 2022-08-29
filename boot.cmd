@echo off 
echo Booting Vault...
set VAULT_SKIP_VERIFY=1
start vault server -config=vault.hcl 

echo Booting Caddy Reverse Proxy...
start caddy_windows_amd64.exe run --config  Caddyfile

echo Booting NodeJS Bulkload Service...
set NODE_TLS_REJECT_UNAUTHORIZED=0
copy vault_server.crt src\bulkloader\cert.pem
copy vault_server.key src\bulkloader\key.pem
cd src\bulkloader
start ..\..\node-v16.17.0-win-x64\node server.js
cd ..\..

echo Unsealing Vault...
timeout 5 > NUL
FOR /f "tokens=1* delims= " %%A IN ( unseal_keys.txt ) DO vault operator unseal %%A