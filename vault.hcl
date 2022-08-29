# Full configuration options can be found at https://www.vaultproject.io/docs/configuration

ui = true                     #Enables the built-in web UI, which is available on all listeners (address + port)
log_level = "Debug"             #Supported log levels: Trace, Debug, Error, Warn, Info.
#log_format = "standard"      #Supported log formats: "standard", "json".

#mlock = true                 #Prevents memory from being swapped to disk. Disabling mlock is not recommended in production.
#disable_mlock = true

#plugin_directory = "/srv/vault/plugins"  #Vault must have permission to read files in this directory to successfully load plugins, and the value cannot be a symbolic link.

api_addr = "http://0.0.0.0:8200"

storage "file" {
  path = "./vault_server"
}

# HTTPS listener
listener "tcp" {
  address       = "0.0.0.0:8200"
  #tls_disable = 0
  #tls_cert_file = "/opt/vault/tls/tls.crt"
  #tls_key_file  = "/opt/vault/tls/tls.key"
  tls_cert_file = "vault_server.crt"
  tls_key_file  = "vault_server.key"
}
