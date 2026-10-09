export const themeInitScript = `(function(){try{var r=document.documentElement,s=localStorage.getItem('motel-theme'),t=s==='light'||s==='dark'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');r.dataset.theme=t==='system'?'':t}catch(e){}})()`;

export default function ThemeInit() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
