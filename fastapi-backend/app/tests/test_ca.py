import ssl

def on_connect(client, userdata, flags, rc):
    print("Connected with result code " + str(rc))

def main():
    import paho.mqtt.client as mqtt
    client = mqtt.Client()
    client.on_connect = on_connect

    # Cấu hình TLS/SSL
    client.tls_set(ca_certs="../certs/ca.crt", tls_version=ssl.PROTOCOL_TLSv1_2)

    # Chú ý: Hostname ở đây PHẢI KHỚP với DNS hoặc IP bạn đã khai báo trong [alt_names] ở Bước 2
    client.connect("14.224.143.43", 8883, 60)
    client.loop_forever()

if __name__ == '__main__':
    main()
