const b=document.getElementById('burger'),m=document.getElementById('menu');
b.addEventListener('click',()=>{const o=m.classList.toggle('open');b.setAttribute('aria-expanded',o)});
m.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{m.classList.remove('open');b.setAttribute('aria-expanded',false)}));
