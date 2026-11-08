#Requires -RunAsAdministrator
# Local development only. Configures the SQLEXPRESS instance for FirstSteps:
#   - SQL Server and Windows authentication (LoginMode = 2)
#   - TCP/IP enabled on loopback only (127.0.0.1:1433); other addresses stay disabled
# Then restarts the SQLEXPRESS service. Changes nothing else.
$ErrorActionPreference = 'Stop'

$instanceId = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL').SQLEXPRESS
if (-not $instanceId) { throw 'SQLEXPRESS instance not found.' }

$server = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer"
$tcp = "$server\SuperSocketNetLib\Tcp"

Set-ItemProperty $server -Name LoginMode -Value 2
Set-ItemProperty $tcp -Name Enabled -Value 1
Set-ItemProperty $tcp -Name ListenOnAllIPs -Value 0

foreach ($ip in Get-ChildItem $tcp | Where-Object { $_.PSChildName -like 'IP*' -and $_.PSChildName -ne 'IPAll' }) {
    $address = (Get-ItemProperty $ip.PSPath).IpAddress
    $isLoopback = $address -eq '127.0.0.1'
    Set-ItemProperty $ip.PSPath -Name Enabled -Value ([int]$isLoopback)
    Set-ItemProperty $ip.PSPath -Name Active -Value ([int]$isLoopback)
    if ($isLoopback) {
        Set-ItemProperty $ip.PSPath -Name TcpPort -Value '1433'
        Set-ItemProperty $ip.PSPath -Name TcpDynamicPorts -Value ''
    }
}

Restart-Service -Name 'MSSQL$SQLEXPRESS' -Force
Write-Output "OK: $instanceId configured (mixed auth, TCP 127.0.0.1:1433) and restarted."
