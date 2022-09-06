#!/usr/bin/env python3

'''Keepalived Tracking Script for HashiCorp Vault HA.

This simple Python script can be used as a Keepalived tracking script for
monitoring an HashiCorp Vault HA cluster and setup a VIP on the active Vault
node.

GitHub Site:
    https://github.com/madrisan/keepalived-vault-ha

This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
'''

__author__ = "Davide Madrisan <davide.madrisan.gmail.com>"
__copyright__ = "Copyright (C) 2018-2020 Davide Madrisan"
__license__ = "GPL-3.0"
__status__ = "Production"
__version__ = "3"

import argparse
import logging
import os
import requests
import sys
from threading import Thread
from systemd.journal import JournalHandler

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

log = logging.getLogger('script')

def parse_args():
    '''This function parses and return arguments passed in'''

    default_timeout = 3

    parser = argparse.ArgumentParser(
        description = 'Keepalived Tracking Script for HashiCorp Vault HA.')
    parser.add_argument(
        "-d", "--debug",
        action = "store_true",
        help = "execute this script in debug mode",
        dest = "debug")
    parser.add_argument(
        "-t", "--timeout",
        help = "stop waiting for a response after a given number of seconds"
               " (default: {0})".format(default_timeout),
        dest = "timeout",
        default = default_timeout,
        type = float)
    parser.add_argument(
        "-u", "--url",
        help = "vault address",
        dest = "url")
    parser.add_argument(
        "--version", action = "version",
        version = "%(prog)s v{0}"
                  " ( https://github.com/madrisan/keepalived-vault-ha )"
                  .format(__version__))

    parser.add_argument('--threaded',     dest='threaded', action='store_true', help="Run test via a separate thread (default)")
    parser.add_argument('--not-threaded', dest='threaded', action='store_false', help="Run test via main process execution")
    parser.set_defaults(threaded=True)

    parser.add_argument(
        "--cert",
        help = "Optional: path to client certificate for vault authentication.",
        dest = "cert",
        default = None)
    parser.add_argument(
        "--key",
        help = "Optional: path client certificate key for vault authentication.",
        dest = "certkey",
        default = None)
    parser.add_argument(
        "--cacert",
        help = "Optional: path to CA certificate if using self-signed certs.",
        dest = "cacert",
        default = None)

    return parser.parse_args()

def check_vault(url, timeout, cacert, cert, certkey):
    '''This function returns True if the node pointed by url (if the --url
       command option has been set) or by the environment variable VAULT_ADDR
       is active, False otherwise.'''

    vault_addr = url if url else os.getenv('VAULT_ADDR', '')
    if not vault_addr:
        log.debug('Neither --url was selected nor VAULT_ADDR is set')
        return False

    log.debug('Vault URL: {}'.format(vault_addr))

    ssl_pair = ()
    vault_cert = cert if cert else os.getenv('VAULT_CLIENT_CERT')
    vault_key = certkey if certkey else os.getenv('VAULT_CLIENT_KEY')
    if vault_cert and vault_key:
        ssl_pair = (vault_cert, vault_key)
        log.debug('Client SSL pair provided: {}'.format(ssl_pair))

    vault_ca = cacert if cacert else os.getenv('VAULT_CACERT')
    if vault_ca:
        log.debug('Using CA: {}'.format(vault_ca))

    api_version = 'v1'
    resource = 'sys/leader'
    leader_url = '{}/{}/{}'.format(vault_addr,
                                   api_version,
                                   resource)
    log.debug(('Found Python requests version {}'
               .format(requests.__version__)))
    log.debug('Querying the URL: {}'.format(leader_url))

    try:
        if vault_ca:
            r = requests.get(leader_url,
                             timeout=timeout,
                             cert=ssl_pair,
                             verify=vault_ca)
        else:
            r = requests.get(leader_url,
                             timeout=timeout,
                             verify=False)

        if r.status_code != requests.codes.ok:
            log.debug(('Requests returned with status code {}'
                       .format(r.status_code)))
            return False

        data = r.json()
        log.debug('Vault reply: {}'.format(data))

        ha_enabled = data.get('ha_enabled', False)
        log.debug('Vault ha_enabled: {}'.format(ha_enabled))

        is_self = data.get('is_self', False)
        log.debug('Vault is_self: {}'.format(is_self))

        #return True
        if ha_enabled and is_self:
            return True
    except requests.exceptions.RequestException as e:
        log.error(format(str(e)))

    return False

def RunVaultCheckThread (url, timeout, cacert, cert, certkey):
    global IsVaultActive

    IsVaultActive = check_vault(args.url,
                                args.timeout,
                                args.cacert,
                                args.cert,
                                args.certkey)

# Global var to determine the state of Vault. Most important when executed via thread
IsVaultActive = False

if __name__ == '__main__':
    args = parse_args()

    log.addHandler(JournalHandler())
    if args.debug:
        log.setLevel(logging.DEBUG)

    # run threaded version, hopefully result/timeout is more consistent
    if args.threaded:
        log.debug('Starting threaded timeout routine : Timeout = ' + str(args.timeout))
        timeoutCnt = 10
        waitTick = args.timeout / timeoutCnt
        log.debug('Tick Count is = ' + str(timeoutCnt) + ', tick check times = ' + str(waitTick))
        vaultThrd = Thread(target = RunVaultCheckThread, args =(args.url, args.timeout, args.cacert, args.cert, args.certkey))
        vaultThrd.start()
        while (timeoutCnt > 0):
            vaultThrd.join(waitTick)
            if not vaultThrd.is_alive():
                break
            timeoutCnt -= 1

        # terminate thread if its alive!
        if vaultThrd.is_alive():
            log.debug ("TIMEOUT EXCEEDED: Thread is still running!")
        else:
            log.debug ("Check completed in " + str((10 - (timeoutCnt-1)) * waitTick) + " seconds")

    else:  # run non-threaded version, timeout does not appear to always work?
        IsVaultActive = check_vault(args.url,
                                args.timeout,
                                args.cacert,
                                args.cert,
                                args.certkey)


    log.debug('EXITING WITH: Vault HA active node: {}'.format(IsVaultActive))
    sys.exit(0 if IsVaultActive else 1)
