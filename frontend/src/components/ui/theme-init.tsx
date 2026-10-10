export const themeInitScript = `(function(){try{var r=document.documentElement,s=null;try{s=localStorage.getItem('motel-theme')}catch(e){}r.dataset.theme=s==='light'||s==='dark'?s:'light'}catch(e){}})()`;

export default function ThemeInit() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
