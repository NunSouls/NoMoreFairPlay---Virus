@echo off
title NoMoreFairPlay // created by ussr (discord id: 952810893698301973) ^| Uptime: 0 seconds - Total Crashes: 0
if not exist "./authCache/" cmd /c md authCache
if not exist package-lock.json cmd /c npm i
prompt $DT$T $L$P$G
:l
node .
:: timeout 60
goto :l