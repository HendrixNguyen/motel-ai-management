import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) createApp(App).mount(root);
