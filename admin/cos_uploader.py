import os
import json
from qcloud_cos import CosConfig
from qcloud_cos import CosS3Client
import sys

class CosUploader:
    def __init__(self, config_path):
        self.config_path = config_path
        self.enabled = False
        self.client = None
        self.bucket = ""
        self.region = ""
        self.cdn_domain = ""
        self.load_config()

    def load_config(self):
        if not os.path.exists(self.config_path):
            return

        try:
            with open(self.config_path, 'r') as f:
                data = json.load(f)
                cos_conf = data.get('cos', {})
                self.enabled = cos_conf.get('enabled', False)
                if not self.enabled:
                    return

                secret_id = cos_conf.get('secret_id')
                secret_key = cos_conf.get('secret_key')
                self.region = cos_conf.get('region')
                self.bucket = cos_conf.get('bucket')
                self.cdn_domain = cos_conf.get('cdn_domain')

                if secret_id and secret_key and self.region and self.bucket:
                    config = CosConfig(Region=self.region, SecretId=secret_id, SecretKey=secret_key)
                    self.client = CosS3Client(config)
                else:
                    print("COS config incomplete. Disabling COS upload.")
                    self.enabled = False
        except Exception as e:
            print(f"Error loading COS config: {e}")
            self.enabled = False

    def upload_file(self, local_path, cos_path):
        """
        Upload a file to COS.
        :param local_path: Local file path
        :param cos_path: Target path in COS (e.g., 'audio/song.mp3')
        :return: Public URL or None
        """
        if not self.enabled or not self.client:
            return None

        try:
            # Upload
            with open(local_path, 'rb') as fp:
                response = self.client.put_object(
                    Bucket=self.bucket,
                    Body=fp,
                    Key=cos_path,
                    StorageClass='STANDARD',
                    EnableMD5=False
                )
            
            # Construct URL
            if self.cdn_domain:
                url = f"https://{self.cdn_domain}/{cos_path}"
            else:
                url = f"https://{self.bucket}.cos.{self.region}.myqcloud.com/{cos_path}"
            
            print(f"Successfully uploaded {local_path} to COS: {url}")
            return url
        except Exception as e:
            print(f"COS Upload error: {e}")
            return None
