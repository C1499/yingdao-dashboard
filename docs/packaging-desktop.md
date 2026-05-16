# 桌面打包说明

## 目标
把当前 `frontend + backend` 一起打成桌面程序，用户双击即可使用，不再手动启动 Node 服务。

## 实现方式
- 使用 Electron 作为桌面壳
- Electron 启动时自动拉起本地 Nest 后端
- 前端加载本地 `dist/index.html`
- 前端 API 改为桌面环境下直连 `http://127.0.0.1:3001/api/yingdao`

## 常用命令
- 开发构建：`npm run build:desktop`
- 打包当前平台：`npm run package`
- 只打 mac：`npm run package:mac`
- 只打 win：`npm run package:win`

## 产物目录
- `release/`

## 注意
- Windows 安装包通常在 Windows 机器上打最稳
- mac 安装包通常在 mac 机器上打最稳
- 第一次分发给别人时，仍然需要在应用里填写影刀凭证
