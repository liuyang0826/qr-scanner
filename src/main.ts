import { qrSanner } from "."

const app = document.querySelector("#app") as HTMLDivElement
const button = document.querySelector("button") as HTMLButtonElement

button.onclick = async () => {
  alert(await qrSanner(app))
}