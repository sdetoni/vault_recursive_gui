# vault_recursive_gui
HasiCorp Vault Recursive GUI overlay

The project implements a GUI over the top of the built in Vault GUI.
It does this using a reverse project and wedging in the Vault GUI using an I-Frame.
The vault_recursive_gui uses standard Vault API calls to recursively search a Vault 
repository on KV2 type secret mount points based upon the logged in user's policies.
Once Vault secrets have been searched or pre-cached, they're stored locally in the client
web browser's memory in an encrypted form using AES-CTR encryption, and a randomly generated key.

In addition to recursive searching, this GUI provides:
   * cut and paste of Vault items and directories.
   * rename and moving of vault items and directories.
   * pin search history.
   * regular expressions in searching.
   * secret password generator.
   * export and import of secrets using json file format.
   * root token generator and revoker.
   * programmer example code to access secret items in Powershell.
   
The project contains an example Vault setup that implements the GUI overly.
It uses 2 dependant pieces of software: 
   Caddy  : A reverse proxy to handle web server, and reverse proxy to Vault daemon.
   NodeJS : Node js server to handle bulk downloading for very large Vault secret databases. 
   
Note: The example Vault secret database in this project should NEVER EVER be used in an production environment without changing unseal keys and the root token!

All API code is written in Javascript and JQuery.

-------------------------------------------------------------------------------------------

Example Software Stack
----------------------

Download NodeJS, Caddy, and Vault:
    NodeJS    https://nodejs.org/dist/v16.17.0/node-v16.17.0-win-x64.zip
    Caddy     https://caddyserver.com/download
    Vault     https://releases.hashicorp.com/vault/1.11.2/vault_1.11.2_windows_amd64.zip
       
Review boot.cmd to see boot sequence.

-------------------------------------------------------------------------------------------

Caddyfile Reverse Proxy:
    Take note of the Caddyfile that overrides a header to handle SAMEORIGIN restrictions.
    This is so it can implement an i-frame from the same server.
    
    # override vault about iframe restrictions and allow it for from the same server.
    header {
        label1 Access-Control-Allow-Origin "*"
        label1 X-Frame-Options "SAMEORIGIN"
        label1 Content-Security-Policy "frame-ancestors 'self';"
    }
    
-------------------------------------------------------------------------------------------
       
Web Client Debug Mode
---------------------
Press F12 (Chrome or Firefox) to enter debug mode, and select the Console tab to view Javascript information.
