(function(){
  if(!/[?&]embed\b/.test(location.search)) return;
  document.documentElement.classList.add('embed');
  var last=0;
  function send(){
    var p=document.querySelector('.page'); if(!p) return;
    var h=Math.ceil(p.getBoundingClientRect().height);
    if(h&&h!==last){ last=h; try{ parent.postMessage({ludiki:'height',h:h},'*'); }catch(e){} }
  }
  window.addEventListener('load',function(){
    send();
    if(window.ResizeObserver){ var p=document.querySelector('.page'); if(p) new ResizeObserver(send).observe(p); }
    window.addEventListener('resize',send);
  });
})();
