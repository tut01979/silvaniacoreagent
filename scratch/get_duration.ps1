$sh = New-Object -ComObject Shell.Application
$f = $sh.NameSpace('C:\Users\eduar\Videos\Grabaciones de pantalla')
$fi = $f.ParseName('video_verificacion_google.mp4')
$d = $f.GetDetailsOf($fi, 27)
Write-Host "DURATION:$d"
