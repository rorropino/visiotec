import express from 'express';import crypto from 'node:crypto';
const app=express();app.use(express.raw({type:'application/json'}));
function valid(body:Buffer,sig:string|undefined,secret:string){if(!sig)return false;const expected=crypto.createHmac('sha256',secret).update(body).digest('hex');try{return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}catch{return false}}
app.get('/health',(_,r)=>r.json({ok:true}));
app.post('/webhooks/github',(req,res)=>{if(!valid(req.body,req.header('x-hub-signature-256')?.replace('sha256=',''),process.env.GITHUB_WEBHOOK_SECRET||''))return res.sendStatus(401);res.status(202).json({accepted:true,source:'github'})});
app.post('/webhooks/linear',(req,res)=>{if(!valid(req.body,req.header('linear-signature'),process.env.LINEAR_WEBHOOK_SECRET||''))return res.sendStatus(401);res.status(202).json({accepted:true,source:'linear'})});
app.listen(Number(process.env.PORT||3000),()=>console.log('sync webhook listening'));