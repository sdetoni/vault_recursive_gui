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


<pre>
-------------------------------------------------------------------------------------------
Vault Raft Config
-----------------
This will not be a step by step building of a Raft Vault cluster as this can be different for many environments.
This setup supports one node to be completely offline, and the Vault cluster can still be active as normal.
This note will describe the network topology, and from there provide example Caddy reverse proxy, and keepalived configurations.


Example/Expected Topology under Linux:

                                                          [Keepalived Virtual IP : vault.blah.com 192.168.1.10]
                                                                                 |
                                                               [ip floats between active raft leader node]
                                                                                 |
            +--------------------------------------------------------------------+----------------------------------------------------------------------+
            |                                                                    |                                                                      |
[vault-node1.blah.com : 192.168.1.11] <- load bal vault:8200      -> [vault-node2.blah.com : 192.168.1.12]  <- load bal vault:8200      -> [vault-node2.blah.com : 192.168.1.13]                        
                        |             <- load bal vaultbulk:16180 ->             |                          <- load bal vaultbulk:16180 ->                      |
                        |             <- raft proto:8201          ->             |                          <- raft proto:8201          ->                      |
                        |                                                        |                                                                              |
                        |                                                        |                                                                              |
                        +--------------------------------------------------------+------------------------------------------------------------------------------+
                                                                                 |
                                                                        [unseal reqests 8200]
                                                                                 |
                                                               [vault-unseal.blah.com : 192.168.1.15]
                                                           
                                                           
keepalived example config
-------------------------
NOTE: See this git repo's version of vault_ha_active_node_threadchker.py script for a customised version to allow localhost tests.

$ cat /etc/keepalived/keepalived.conf
global_defs {
    notification_email {
        blah@blah.com
    }
    notification_email_from firewalld@blah.com
    smtp_server localhost
    smtp_connect_timeout 30

    # enable script settings
    enable_script_security
    script_user root

    # delay startup of keepalived, server reboot appears to cause issues.
    vrrp_startup_delay 3

    # minimum time interval for refreshing gratuitous ARPs while MASTER
    vrrp_garp_master_refresh 300  # secs, default 0 (no refreshing)
}

vrrp_script vault_active_node_script {
    # testing script located here: https://github.com/madrisan/keepalived-vault-ha
    script       "/usr/libexec/keepalived/vault_ha_active_node_threadchker.py --timeout=1 --url='https://127.0.0.1:8200'"
    user vault   # Run test as vault user
    interval 3   # Run script every 3 seconds
    fall 1       # If script returns non-zero 2 times in succession, enter FAULT state
    rise 3       # If script returns zero r times in succession, exit FAULT state
    timeout 2    # Wait up to t seconds for script before assuming non-zero exit code
    weight 10    # Reduce priority by 10 on fall
}

vrrp_instance VIP_VAULT_HA {
    state BACKUP
    interface eth0
    virtual_router_id 10
    priority 90
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass ***********
    }
    virtual_ipaddress {
        192.168.1.10/24
    }
    track_script {
        vault_active_node_script
    }
}




Vault Example Scripts Node1
---------------------------
$ cat /etc/vault.d/vault.hcl

# Full configuration options can be found at https://www.vaultproject.io/docs/configuration

ui = true                     #Enables the built-in web UI, which is available on all listeners (address + port)
#log_level = "Debug"           #Supported log levels: Trace, Debug, Error, Warn, Info.
log_level = "Info"            #Supported log levels: Trace, Debug, Error, Warn, Info.
#log_format = "standard"      #Supported log formats: "standard", "json".

#mlock = true                 #Prevents memory from being swapped to disk. Disabling mlock is not recommended in production.
#disable_mlock = true

api_addr = "http://vault-node1.blah.com:8200"
cluster_addr = "http://vault-node1.blah.com:8201"
disable_mlock = true

storage "raft" {
  path = "/opt/vault_raft"
  node_id = "node1"

  retry_join {
    leader_api_addr = "https://vault-node2.blah.com:8200"
  }

  retry_join {
    leader_api_addr = "https://vault-node3.blah.com:8200"
  }
}

# HTTPS listener
listener "tcp" {
  address      = "vault-node1.blah.com:8200"
  cluster_addr = "vault-node1.blah.com:8201"
  #tls_disable = 0
  tls_cert_file = "/etc/pki/tls/certs/vault-cert.blah.com.crt"
  tls_key_file  = "/etc/pki/tls/private/vault-cert.blah.com.key"
}

listener "tcp" {
  address = "127.0.0.1:8200"

  cluster_addr = "vault-node1.blah.com:8201"
  #tls_disable = 0
  tls_cert_file = "/etc/pki/tls/certs/vault-cert.blah.com.crt"
  tls_key_file  = "/etc/pki/tls/private/vault-cert.blah.com.key"

}

seal "transit" {
  address = "https://vault-unseal.blah.com:8200"
  token = "s.****************"
  disable_renewal = "false"
  key_name = "autounseal"
  mount_path = "transit/"

  tls_skip_verify = "false"
}




Vault Example Scripts Node2
---------------------------
$ cat /etc/vault.d/vault.hcl

# Full configuration options can be found at https://www.vaultproject.io/docs/configuration

ui = true                     #Enables the built-in web UI, which is available on all listeners (address + port)
#log_level = "Debug"           #Supported log levels: Trace, Debug, Error, Warn, Info.
log_level = "Info"            #Supported log levels: Trace, Debug, Error, Warn, Info.
#log_format = "standard"      #Supported log formats: "standard", "json".

#mlock = true                 #Prevents memory from being swapped to disk. Disabling mlock is not recommended in production.
#disable_mlock = true

api_addr = "http://vault-node2.blah.com:8200"
cluster_addr = "http://vault-node2.blah.com:8201"
disable_mlock = true

storage "raft" {
  path = "/opt/vault_raft"
  node_id = "node1"

  retry_join {
    leader_api_addr = "https://vault-node1.blah.com:8200"
  }

  retry_join {
    leader_api_addr = "https://vault-node3.blah.com:8200"
  }
}

# HTTPS listener
listener "tcp" {
  address      = "vault-node2.blah.com:8200"
  cluster_addr = "vault-node2.blah.com:8201"
  #tls_disable = 0
  tls_cert_file = "/etc/pki/tls/certs/vault-cert.blah.com.crt"
  tls_key_file  = "/etc/pki/tls/private/vault-cert.blah.com.key"
}

listener "tcp" {
  address = "127.0.0.1:8200"

  cluster_addr = "vault-node2.blah.com:8201"
  #tls_disable = 0
  tls_cert_file = "/etc/pki/tls/certs/vault-cert.blah.com.crt"
  tls_key_file  = "/etc/pki/tls/private/vault-cert.blah.com.key"

}

seal "transit" {
  address = "https://vault-unseal.blah.com:8200"
  token = "s.****************"
  disable_renewal = "false"
  key_name = "autounseal"
  mount_path = "transit/"

  tls_skip_verify = "false"
}




Vault Example Scripts Node3
---------------------------
$ cat /etc/vault.d/vault.hcl

# Full configuration options can be found at https://www.vaultproject.io/docs/configuration

ui = true                     #Enables the built-in web UI, which is available on all listeners (address + port)
#log_level = "Debug"           #Supported log levels: Trace, Debug, Error, Warn, Info.
log_level = "Info"            #Supported log levels: Trace, Debug, Error, Warn, Info.
#log_format = "standard"      #Supported log formats: "standard", "json".

#mlock = true                 #Prevents memory from being swapped to disk. Disabling mlock is not recommended in production.
#disable_mlock = true

api_addr = "http://vault-node3.blah.com:8200"
cluster_addr = "http://vault-node3.blah.com:8201"
disable_mlock = true

storage "raft" {
  path = "/opt/vault_raft"
  node_id = "node1"

  retry_join {
    leader_api_addr = "https://vault-node1.blah.com:8200"
  }

  retry_join {
    leader_api_addr = "https://vault-node2.blah.com:8200"
  }
}

# HTTPS listener
listener "tcp" {
  address      = "vault-node3.blah.com:8200"
  cluster_addr = "vault-node3.blah.com:8201"
  #tls_disable = 0
  tls_cert_file = "/etc/pki/tls/certs/vault-cert.blah.com.crt"
  tls_key_file  = "/etc/pki/tls/private/vault-cert.blah.com.key"
}

listener "tcp" {
  address = "127.0.0.1:8200"

  cluster_addr = "vault-node3.blah.com:8201"
  #tls_disable = 0
  tls_cert_file = "/etc/pki/tls/certs/vault-cert.blah.com.crt"
  tls_key_file  = "/etc/pki/tls/private/vault-cert.blah.com.key"

}

seal "transit" {
  address = "https://vault-unseal.blah.com:8200"
  token = "s.****************"
  disable_renewal = "false"
  key_name = "autounseal"
  mount_path = "transit/"

  tls_skip_verify = "false"
}


-------------------------------------------------------------------------------------------


Caddy Load Balancer Config Node1
--------------------------------
$ cat /etc/caddy/Caddyfile

# Disable administration API
# Probably shouldn't be used unless you can guarantee only trusted users can log in locally on server
{
  admin off
}

vault-node1.blah.com  {
#    log {
#        output stdout
#        format console
#        level debug
#    }

    # compress all standard text formats ...
    encode {
        zstd gzip
    }

    # Development path to to full development path
    redir /recsearch_dev   /recsearch_dev/ permanent

    # redirect root and research paths
    redir /            /recsearch/ permanent
    redir /recsearch   /recsearch/ permanent

    # override vault about iframe restrictions and allow it for from the same server.
    header {
        label1 Access-Control-Allow-Origin "*"
        label1 X-Frame-Options "SAMEORIGIN"
        label1 Content-Security-Policy "frame-ancestors 'self';"
    }

    # file location for the javascript based recursive search html doc
    route {
        header ?Cache-Control "max-age=3600"

        file_server /recsearch/* {
            root /var/www/
        }
    }

    # reverse proxy for nodejs bulk loader of secrets...
    route /vaultbulkcacheloader* {
        reverse_proxy https://vault-node1.blah.com:16180
    }

    # Proxy all traffic over HTTP to Vault on 8200
    reverse_proxy https://vault-node1.blah.com:8200 {
        # remove header Content-Security-Policy from proxy return, replace it with the one in header override
        header_down -Content-Security-Policy
    }

    # SSL Cert
    tls /etc/pki/tls/certs/vault-cert.blah.com.crt /etc/pki/tls/certs/vault-cert.blah.com.key {
        protocols tls1.2
        ciphers TLS_RSA_WITH_AES_256_CBC_SHA TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
    }
}

vault.blah.com  {
#    log {
#        output stdout
#        format console
#        level  info
#    }

    # compress all standard text formats ...
    encode {
        zstd gzip
    }

    # redirect root and research paths
    redir /            /recsearch/ permanent
    redir /recsearch   /recsearch/ permanent

    # override vault about iframe restrictions and allow it for from the same server.
    header {
        label1 Access-Control-Allow-Origin "*"
        label1 X-Frame-Options "SAMEORIGIN"
        label1 Content-Security-Policy "frame-ancestors 'self';"
    }

    # file location for the javascript based recursive search html doc
    route {
        header ?Cache-Control "max-age=3600"

        file_server /recsearch/* {
            root /var/www/
        }
    }

    # reverse proxy for nodejs bulk loader of secrets...
    route /vaultbulkcacheloader* {
        reverse_proxy  https://vault-node1.blah.com:16180  https://vault-node2.blah.com:16180 https://vault-node3.blah.com:16180 {
            lb_policy        round_robin

            # vault status
            health_path      /status
            health_status    200
            health_interval  30s
        }
    }


    # Proxy all traffic over HTTPS to Vault nodes on 8200
    reverse_proxy  https://vault-node1.blah.com:8200 https://vault-node2.blah.com:8200 https://vault-node3.blah.com:8200 {
        lb_policy        round_robin

        # vault status
        health_path      /v1/sys/seal-status
        health_status    200
        health_body      initialized":true.*"sealed":false.*
        health_interval  30s

        # remove header Content-Security-Policy from proxy return, replace it with the one in header override
        header_down -Content-Security-Policy
    }

    # SSL Cert
    tls /etc/pki/tls/certs/vault-cert.blah.com.crt /etc/pki/tls/certs/vault-cert.blah.com.key {
        protocols tls1.2
        ciphers TLS_RSA_WITH_AES_256_CBC_SHA TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
    }
}




Caddy Load Balancer Config Node2
--------------------------------
$ cat /etc/caddy/Caddyfile

# Disable administration API
# Probably shouldn't be used unless you can guarantee only trusted users can log in locally on server
{
  admin off
}

vault-node2.blah.com  {
#    log {
#        output stdout
#        format console
#        level debug
#    }

    # compress all standard text formats ...
    encode {
        zstd gzip
    }

    # Development path to to full development path
    redir /recsearch_dev   /recsearch_dev/ permanent

    # redirect root and research paths
    redir /            /recsearch/ permanent
    redir /recsearch   /recsearch/ permanent

    # override vault about iframe restrictions and allow it for from the same server.
    header {
        label1 Access-Control-Allow-Origin "*"
        label1 X-Frame-Options "SAMEORIGIN"
        label1 Content-Security-Policy "frame-ancestors 'self';"
    }

    # file location for the javascript based recursive search html doc
    route {
        header ?Cache-Control "max-age=3600"

        file_server /recsearch/* {
            root /var/www/
        }
    }

    # reverse proxy for nodejs bulk loader of secrets...
    route /vaultbulkcacheloader* {
        reverse_proxy https://vault-node2.blah.com:16180
    }

    # Proxy all traffic over HTTP to Vault on 8200
    reverse_proxy https://vault-node2.blah.com:8200 {
        # remove header Content-Security-Policy from proxy return, replace it with the one in header override
        header_down -Content-Security-Policy
    }

    # SSL Cert
    tls /etc/pki/tls/certs/vault-cert.blah.com.crt /etc/pki/tls/certs/vault-cert.blah.com.key {
        protocols tls1.2
        ciphers TLS_RSA_WITH_AES_256_CBC_SHA TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
    }
}

vault.blah.com  {
#    log {
#        output stdout
#        format console
#        level  info
#    }

    # compress all standard text formats ...
    encode {
        zstd gzip
    }

    # redirect root and research paths
    redir /            /recsearch/ permanent
    redir /recsearch   /recsearch/ permanent

    # override vault about iframe restrictions and allow it for from the same server.
    header {
        label1 Access-Control-Allow-Origin "*"
        label1 X-Frame-Options "SAMEORIGIN"
        label1 Content-Security-Policy "frame-ancestors 'self';"
    }

    # file location for the javascript based recursive search html doc
    route {
        header ?Cache-Control "max-age=3600"

        file_server /recsearch/* {
            root /var/www/
        }
    }

    # reverse proxy for nodejs bulk loader of secrets...
    route /vaultbulkcacheloader* {
        reverse_proxy  https://vault-node1.blah.com:16180  https://vault-node2.blah.com:16180 https://vault-node3.blah.com:16180 {
            lb_policy        round_robin

            # vault status
            health_path      /status
            health_status    200
            health_interval  30s
        }
    }


    # Proxy all traffic over HTTPS to Vault nodes on 8200
    reverse_proxy  https://vault-node1.blah.com:8200 https://vault-node2.blah.com:8200 https://vault-node3.blah.com:8200 {
        lb_policy        round_robin

        # vault status
        health_path      /v1/sys/seal-status
        health_status    200
        health_body      initialized":true.*"sealed":false.*
        health_interval  30s

        # remove header Content-Security-Policy from proxy return, replace it with the one in header override
        header_down -Content-Security-Policy
    }

    # SSL Cert
    tls /etc/pki/tls/certs/vault-cert.blah.com.crt /etc/pki/tls/certs/vault-cert.blah.com.key {
        protocols tls1.2
        ciphers TLS_RSA_WITH_AES_256_CBC_SHA TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
    }
}




Caddy Load Balancer Config Node3
--------------------------------
$ cat /etc/caddy/Caddyfile

# Disable administration API
# Probably shouldn't be used unless you can guarantee only trusted users can log in locally on server
{
  admin off
}

vault-node3.blah.com  {
#    log {
#        output stdout
#        format console
#        level debug
#    }

    # compress all standard text formats ...
    encode {
        zstd gzip
    }

    # Development path to to full development path
    redir /recsearch_dev   /recsearch_dev/ permanent

    # redirect root and research paths
    redir /            /recsearch/ permanent
    redir /recsearch   /recsearch/ permanent

    # override vault about iframe restrictions and allow it for from the same server.
    header {
        label1 Access-Control-Allow-Origin "*"
        label1 X-Frame-Options "SAMEORIGIN"
        label1 Content-Security-Policy "frame-ancestors 'self';"
    }

    # file location for the javascript based recursive search html doc
    route {
        header ?Cache-Control "max-age=3600"

        file_server /recsearch/* {
            root /var/www/
        }
    }

    # reverse proxy for nodejs bulk loader of secrets...
    route /vaultbulkcacheloader* {
        reverse_proxy https://vault-node3.blah.com:16180
    }

    # Proxy all traffic over HTTP to Vault on 8200
    reverse_proxy https://vault-node3.blah.com:8200 {
        # remove header Content-Security-Policy from proxy return, replace it with the one in header override
        header_down -Content-Security-Policy
    }

    # SSL Cert
    tls /etc/pki/tls/certs/vault-cert.blah.com.crt /etc/pki/tls/certs/vault-cert.blah.com.key {
        protocols tls1.2
        ciphers TLS_RSA_WITH_AES_256_CBC_SHA TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
    }
}

vault.blah.com  {
#    log {
#        output stdout
#        format console
#        level  info
#    }

    # compress all standard text formats ...
    encode {
        zstd gzip
    }

    # redirect root and research paths
    redir /            /recsearch/ permanent
    redir /recsearch   /recsearch/ permanent

    # override vault about iframe restrictions and allow it for from the same server.
    header {
        label1 Access-Control-Allow-Origin "*"
        label1 X-Frame-Options "SAMEORIGIN"
        label1 Content-Security-Policy "frame-ancestors 'self';"
    }

    # file location for the javascript based recursive search html doc
    route {
        header ?Cache-Control "max-age=3600"

        file_server /recsearch/* {
            root /var/www/
        }
    }

    # reverse proxy for nodejs bulk loader of secrets...
    route /vaultbulkcacheloader* {
        reverse_proxy  https://vault-node1.blah.com:16180  https://vault-node2.blah.com:16180 https://vault-node3.blah.com:16180 {
            lb_policy        round_robin

            # vault status
            health_path      /status
            health_status    200
            health_interval  30s
        }
    }


    # Proxy all traffic over HTTPS to Vault nodes on 8200
    reverse_proxy  https://vault-node1.blah.com:8200 https://vault-node2.blah.com:8200 https://vault-node3.blah.com:8200 {
        lb_policy        round_robin

        # vault status
        health_path      /v1/sys/seal-status
        health_status    200
        health_body      initialized":true.*"sealed":false.*
        health_interval  30s

        # remove header Content-Security-Policy from proxy return, replace it with the one in header override
        header_down -Content-Security-Policy
    }

    # SSL Cert
    tls /etc/pki/tls/certs/vault-cert.blah.com.crt /etc/pki/tls/certs/vault-cert.blah.com.key {
        protocols tls1.2
        ciphers TLS_RSA_WITH_AES_256_CBC_SHA TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
    }
}

-------------------------------------------------------------------------------------------


Caddy Load Balancer Config (unseal node)
----------------------------------------
$ cat /etc/caddy/Caddyfile

# Disable administration API
# Probably shouldn't be used unless you can guarantee only trusted users can log in locally on server
{
  admin off
}

# Hostname for site
# Bare hostname without protocol is preferred as this enables automatic HTTP to HTTPS redirection
vault-unseal.blah.com

# Proxy all traffic over HTTP to Vault on 8200
#
# https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
#
reverse_proxy https://vault-unseal.blah.com:8200

# Configure TLS to use a specified certificate and key
# (will otherwise try to use automatic Let's Encrypt which requires server  to allow inbound web traffic from internet)
#
# https://caddyserver.com/docs/caddyfile/directives/tls#tls
#
tls /etc/pki/tls/certs/vault-cert.blah.com.crt /etc/pki/tls/certs/vault-cert.blah.com.key 

