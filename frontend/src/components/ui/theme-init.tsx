export const themeInitScript = `(function(){try{var r=document.documentElement,s=null;try{s=localStorage.getItem('motel-theme')}catch(e){}if(s==='light'||s==='dark'){r.dataset.theme=s}else if(s==='system'){r.dataset.theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}else{r.dataset.theme='light'}}catch(e){}})()`;

export default function ThemeInit() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
