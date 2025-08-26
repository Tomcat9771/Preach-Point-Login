(function(){
  const style = document.createElement('style');
  style.textContent = `
.pp-alert-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;}
.pp-alert{background:#fff;color:#1a1a1a;padding:20px;border-radius:10px;max-width:90%;min-width:260px;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif;box-shadow:0 4px 10px rgba(0,0,0,.3);}
.pp-alert-title{margin:0 0 10px;font-size:18px;font-weight:bold;color:#6B1A7B;}
.pp-alert button{margin-top:15px;}
`;
  document.head.appendChild(style);

  window.ppAlert = function(message){
    const overlay = document.createElement('div');
    overlay.className = 'pp-alert-overlay';
    const box = document.createElement('div');
    box.className = 'pp-alert';
    const title = document.createElement('div');
    title.className = 'pp-alert-title';
    title.textContent = 'Preach Point says';
    const body = document.createElement('div');
    body.textContent = message;
    const btn = document.createElement('button');
    btn.textContent = 'OK';
    btn.onclick = () => overlay.remove();
    box.append(title, body, btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    btn.focus();
  };
})();
