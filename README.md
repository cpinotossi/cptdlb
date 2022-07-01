# Azure Load Balancer

## Simple LB setup with 2 vm in backend pool

TBD

## Use Azure standard LB with VM with multiple IPs (NOT WORKING!!!)

based on https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-multiple-ip-cli

Create the foundation of our network.
~~~ bash
prefix=cptdlb
location=eastus
az group create -n $prefix -l $location
az network vnet create -g $prefix -n $prefix --address-prefixes 10.8.0.0/16 --location $location --subnet-name $prefix --subnet-prefix 10.8.0.0/24
az network vnet subnet create -n AzureBastionSubnet -g $prefix --vnet-name $prefix --address-prefixes "10.8.1.0/24"
az network public-ip create -g $prefix -l $location -n ${prefix}bastion --dns-name ${prefix}bastion --sku Standard
az network bastion create --name $prefix --public-ip-address ${prefix}bastion -g $prefix --vnet-name $prefix --location $location
# create a jump host vm which will not sit behind the loadbalancer. It will be used to test the deployment from inside the vnet.
az network nic create -g $prefix -l $location --vnet-name $prefix --subnet $prefix --name ${prefix}jh
az vm create -g $prefix --name ${prefix}jh --location $location --nics ${prefix}jh --size Standard_DS3_v2 --image canonical:UbuntuServer:16.04.0-LTS:latest --admin-username chpinoto --admin-password 'demo!pass123'
~~~

Create the Public Standard Azure Loadbalancer.
~~~ bash
az network public-ip create -n ${prefix}lb -g $prefix -l $location --dns-name ${prefix}lb --sku Standard --allocation-method Static
pubip=$(az network public-ip show  -g $prefix -n ${prefix}lb --query id -o tsv)
az network lb create -g $prefix -l $location -n $prefix --public-ip-address $pubip --sku Standard --frontend-ip-name $prefix
az network lb address-pool create -g $prefix --lb-name $prefix --name $prefix
az network lb probe create -g $prefix --lb-name $prefix --name $prefix --protocol "http" --interval 15 --path index.html --port 8080
az network lb rule create -g $prefix --lb-name $prefix --name $prefix --protocol tcp --probe-name $prefix --frontend-port 80 --backend-port 8080 --frontend-ip-name $prefix --backend-pool-name $prefix
~~~

Create the vm and nics which are used with the LB backend.
~~~ bash
lbbeid=$(az network lb show -g $prefix --name $prefix --query backendAddressPools[1].id -o tsv)
az network nic create -g $prefix -l $location --vnet-name $prefix --subnet $prefix --name ${prefix}1 --lb-name $prefix --lb-address-pools $lbbeid
az network nic create -g $prefix -l $location --vnet-name $prefix --subnet $prefix --name ${prefix}2 --lb-name $prefix --lb-address-pools $lbbeid
ip1=$(az network nic show -g $prefix --name ${prefix}1 --query ipConfigurations[].privateIpAddress -o tsv)
ip2=$(az network nic show -g $prefix --name ${prefix}2 --query ipConfigurations[].privateIpAddress -o tsv)
cat ./vmnodejs.yaml | sed "s|<INTERFACEIP1>|${ip1}|g" > vmlb.yaml # modify the cloud init file
sed -i "s|<INTERFACEIP2>|${ip2}|g" vmlb.yaml  # still modifying the cloud init file
az vm create -g $prefix --name $prefix --location $location --nics ${prefix}1 ${prefix}2 --size Standard_DS3_v2 --image canonical:UbuntuServer:16.04.0-LTS:latest --admin-username chpinoto --admin-password 'demo!pass123' --custom-data vmlb.yaml
~~~

### Verify and Test

Verify if the vm has two NICs assigned.
~~~ bash
az vm show -g $prefix -n ${prefix} --query networkProfile.networkInterfaces # cptdlb1 is the primary
az network nic show -g $prefix --name ${prefix}1 --query ipConfigurations[].privateIpAddress -o tsv #10.8.0.5 primary, will be red.
az network nic show -g $prefix --name ${prefix}2 --query ipConfigurations[].privateIpAddress -o tsv #10.8.0.6, will be green.
~~~

SSH into the vm which sits behind the azure loadbalancer
> NOTE: You will need to turn on native client support via the portal as follow: https://docs.microsoft.com/en-us/azure/bastion/connect-native-client-windows#modify-host. Via bicep we could configure this right from the beginning.

~~~ bash
vmid=$(az vm show -g $prefix -n $prefix --query id -o tsv)
az network bastion ssh -n $prefix -g $prefix --target-resource-id $vmid --auth-type password --username chpinoto
curl -v http://localhost:8080/index.html # 200 OK
curl -v http://localhost:8080/index.html # 200 OK
curl -v http://10.8.0.5:8080/index.html # Timeout
curl -v http://10.8.0.6:8080/index.html # 200 OK
~~~

Verify the network interfaces on OS level.
~~~ bash
ip route
~~~

Outcome
~~~
default via 10.8.0.1 dev eth0 
10.8.0.0/24 dev eth1  proto kernel  scope link  src 10.8.0.5 
10.8.0.0/24 dev eth0  proto kernel  scope link  src 10.8.0.4 
168.63.129.16 via 10.8.0.1 dev eth0 
169.254.169.254 via 10.8.0.1 dev eth0 
~~~

~~~ bash
route -n
~~~

Outcome:
~~~
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         10.8.0.1        0.0.0.0         UG    0      0        0 eth0
10.8.0.0        0.0.0.0         255.255.255.0   U     0      0        0 eth1
10.8.0.0        0.0.0.0         255.255.255.0   U     0      0        0 eth0
168.63.129.16   10.8.0.1        255.255.255.255 UGH   0      0        0 eth0
169.254.169.254 10.8.0.1        255.255.255.255 UGH   0      0        0 eth0
~~~

~~~ bash
netstat -nr
~~~

Outcome:
~~~
Kernel IP routing table
Destination     Gateway         Genmask         Flags   MSS Window  irtt Iface
0.0.0.0         10.8.0.1        0.0.0.0         UG        0 0          0 eth0
10.8.0.0        0.0.0.0         255.255.255.0   U         0 0          0 eth1
10.8.0.0        0.0.0.0         255.255.255.0   U         0 0          0 eth0
168.63.129.16   10.8.0.1        255.255.255.255 UGH       0 0          0 eth0
169.254.169.254 10.8.0.1        255.255.255.255 UGH       0 0          0 eth0
~~~

~~~ bash
ip rule
~~~

Outcome:
~~~
0:      from all lookup local 
32766:  from all lookup main 
32767:  from all lookup default
~~~

~~~ bash
cat /etc/iproute2/rt_tables
~~~

Outcome:
~~~
#
# reserved values
#
255     local
254     main
253     default
0       unspec
#
# local
#
#1      inr.ruhep
~~~

To send to or from the secondary network interface (eth1), you have to manually add persistent routes to the operating system for each secondary network interface. 
(source: https://docs.microsoft.com/en-us/azure/virtual-machines/linux/multiple-nics#configure-guest-os-for-multiple-nics)

~~~ bash
sudo echo "1 admin" >> /etc/iproute2/rt_tables
ip route add 10.8.0.0/24 dev eth1 src 10.8.0.5 table admin
ip route add default via 10.10.70.254 dev eth0 table admin

iproute2
nano /etc/iproute2/rt_tables
sudo -i 
route add -net 0.0.0.0/0 gw 10.8.0.1 eth1
az vm restart -g $prefix -n $prefix
logout #logout from the current vm
~~~

Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         10.0.1.1        0.0.0.0         UG    0      0        0 eth0
0.0.0.0         10.0.2.1        0.0.0.0         UG    0      0        0 eth1
10.0.1.0        0.0.0.0         255.255.255.0   U     0      0        0 eth0
10.0.2.0        0.0.0.0         255.255.255.0   U     0      0        0 eth1
168.63.129.16   10.0.1.1        255.255.255.255 UGH   0      0        0 eth0
169.254.169.254 10.0.1.1        255.255.255.255 UGH   0      0        0 eth0



Verify if port 8080 is running our server.js
~~~ bash
sudo netstat -tapn | grep 8080 
~~~

Outcome
> tcp        0      0 0.0.0.0:8080            0.0.0.0:*               LISTEN      4783/server.js

If the server.js is listening on all the IP addresses that are present on our vm then we should see it bound to the special IP 0.0.0.0. This means both nic that are attached to the vm have an IP associated with server.js.





Send request via both NICs
~~~ bash
az network nic show -g $prefix --name ${prefix}1 --query ipConfigurations[].privateIpAddress -o tsv
az network nic show -g $prefix --name ${prefix}2 --query ipConfigurations[].privateIpAddress -o tsv
vmid2=$(az vm show -g $prefix -n ${prefix}2 --query id -o tsv)
az network bastion ssh -n $prefix -g $prefix --target-resource-id $vmid2 --auth-type password --username chpinoto
ping 10.8.0.4 # run into timeout
ping 10.8.0.5 # works
curl -v http://10.8.0.4:8080/ # timeout
curl -v http://10.8.0.5:8080/ # 200 OK
logout
~~~

Seems like only the non-primary NIC (10.8.0.5) is reachable from inside the vnet.

Request via LB
~~~ bash
az network lb show -g $prefix --name $prefix
lbd=$(az network public-ip show -n ${prefix}lb -g $prefix --query dnsSettings.fqdn -o tsv)
curl -v http://$lbd/



sudo netstat -tapn | grep 8080 
~~~




We will need to modify the vm to run an web server.
TODO: get this done through cloudinit config file.

~~~ bash
nohup python -m SimpleHTTPServer 8080  >/dev/null 2>&1 &  # run a simple http server in the background on the vm
ps ax | grep SimpleHTTPServer # find the process
ss -ltnp # verify if the port is used
ip link show # list all network interfaces
ip address show # list all ips on the vm
~~~

~~~ bash
curl -v http://cptdlblb.eastus.cloudapp.azure.com/
az group delete -n $prefix -y
~~~

### Test

Test from the jump host by using bastion host

~~~ bash
vmidjh=$(az vm show -g $prefix -n ${prefix}jh --query id -o tsv)
az network bastion ssh -n $prefix -g $prefix --target-resource-id $vmidjh --auth-type password --username chpinoto
curl -v http://localhost:8080/index.html # 200 OK
curl -v http://localhost:8081/index.html # 200 OK
curl -v http://10.8.0.5:8080/index.html # Timeout
curl -v http://10.8.0.6:8081/index.html # 200 OK
~~~

## Misc

### github
~~~ bash
git init
git add *
gh repo create $prefix --public
git remote add origin https://github.com/cpinotossi/${prefix}.git
git commit -m"init"
git push origin main
git rm -r --cached nodejs/ # unstage
~~~