export default function ThemeInit() {
  const script = `(function(){try{var t=localStorage.getItem('motel-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}})()`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
