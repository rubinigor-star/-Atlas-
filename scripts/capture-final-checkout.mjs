import fs from 'node:fs';
fs.mkdirSync('public/__cleanup',{recursive:true});
fs.copyFileSync('src/components/checkout-form.tsx','public/__cleanup/checkout-form.tsx.txt');
fs.copyFileSync('src/components/checkout-form.module.css','public/__cleanup/checkout-form.module.css.txt');
console.log('Captured final checkout sources for cleanup audit');
