import os
import sys
import paramiko

hostname = "92.249.46.170"
port = 65002
username = "u554613359"
remote_path = "/home/u554613359/domains/qa.shikshapilot.com/public_html"
local_tar = "c:/Users/bilal/Documents/BN School/.builds/deploy.tar.gz"

print("Initializing SSH client...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

# Fallback chain for authentication
connected = False
try:
    print("Attempting connection using SSH Private Key (id_rsa)...")
    key_path = os.path.expanduser("~/.ssh/id_rsa")
    if os.path.exists(key_path):
        key = paramiko.RSAKey.from_private_key_file(key_path)
        ssh.connect(hostname, port=port, username=username, pkey=key, timeout=15)
        connected = True
        print("Connected successfully via SSH private key!")
    else:
        print("No SSH private key found at ~/.ssh/id_rsa.")
except Exception as e:
    print(f"SSH Key authentication failed: {e}")

if not connected:
    passwords = ["Billu@9012", "Ga@1219!", "/Q5GYsafK5Vs"]
    for p in passwords:
        try:
            print(f"Attempting connection using password target '{p[:3]}...'")
            ssh.connect(hostname, port=port, username=username, password=p, timeout=15)
            connected = True
            print("Connected successfully via password!")
            break
        except Exception as e:
            print(f"Password target '{p[:3]}...' authentication failed: {e}")

if not connected:
    print("Error: Could not authenticate to Hostinger server via key or password.")
    sys.exit(1)

# Upload deploy.tar.gz
print("Uploading deploy.tar.gz via SFTP...")
sftp = ssh.open_sftp()
remote_tar_path = f"{remote_path}/deploy.tar.gz"
sftp.put(local_tar, remote_tar_path)
sftp.close()
print("Upload completed successfully!")

# Execute remote extraction and migration commands
print("Extracting package and running migrations on remote server...")
extract_cmd = f"cd {remote_path} && rm -rf assets api index.html && tar -xzf deploy.tar.gz && rm deploy.tar.gz && composer install --no-dev --optimize-autoloader --working-dir={remote_path}/api && php api/src/Database/migrate.php"

stdin, stdout, stderr = ssh.exec_command(extract_cmd)
exit_status = stdout.channel.recv_exit_status()

print("\n--- Remote Command Output ---")
output_bytes = stdout.read()
output_str = output_bytes.decode('utf-8', errors='replace').replace('\u2713', '[OK]')
print(output_str)
stderr_str = stderr.read().decode('utf-8', errors='replace').replace('\u2713', '[OK]')
print(stderr_str)
print("-----------------------------")

if exit_status == 0:
    print("Deployment completed successfully on QA server!")
else:
    print(f"Deployment failed on remote server with exit code: {exit_status}")
    sys.exit(exit_status)

ssh.close()
