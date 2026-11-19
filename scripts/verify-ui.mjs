import { listDevices, props, controlDevice } from '../index.js'
import { startUiServer } from '../ui/server.js'

const url = await startUiServer({ port: 5889, listDevices, props, control: controlDevice })
console.log(url)
setInterval(() => {}, 60_000)
