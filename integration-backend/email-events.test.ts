import { expect, it } from 'vitest';
import { integrationNoticesFor } from './email-events';
const base = { id: 'report', title: 'Demo', reporterEmail: 'client@withmeridian.ai', reporterName: 'Client', status: 'NEW' };
const image = (v: Record<string,string>) => Object.fromEntries(Object.entries(v).map(([k,S])=>[k,{S}]));
const change = (before: Record<string,string>,after: Record<string,string>) => integrationNoticesFor({eventName:'MODIFY',dynamodb:{OldImage:image(before),NewImage:image(after)}});
it('sends submission mail to client and selected admins',()=>expect(integrationNoticesFor({eventName:'INSERT',dynamodb:{NewImage:image(base)}}).map(n=>n.kind)).toEqual(['client-submitted','admin-submitted']));
it.each(['ASSIGNED','IN_PROGRESS'])('does not email clients for routine status %s',status=>expect(change(base,{...base,status,adminActivityAt:'2026-10-12T12:00:00Z'})).toEqual([]));
it('notifies only admins about a new client request',()=>expect(change(base,{...base,updateRequestedAt:'2026-10-12T12:00:00Z'}).map(n=>n.kind)).toEqual(['update-requested']));
it('requires the trusted response event for a pending request',()=>{
 const pending={...base,updateRequestedAt:'2026-10-12T12:00:00Z'};
 const updated={...pending,status:'ASSIGNED',adminActivityAt:'2026-10-12T12:01:00Z'};
 expect(change(pending,updated)).toEqual([]);
 expect(change(pending,{...updated,updateRespondedAt:updated.adminActivityAt})).toMatchObject([{kind:'admin-updated',audience:'client'}]);
 expect(change({...pending,adminActivityAt:'2026-10-12T12:00:30Z'},{...updated,updateRespondedAt:updated.adminActivityAt})).toEqual([]);
 expect(change(updated,{...updated,updateRespondedAt:'invalid'})).toEqual([]);
});
it('closure sends one client mail even when responding to a pending request',()=>{
 const pending={...base,updateRequestedAt:'2026-10-12T12:00:00Z'};
 expect(change(pending,{...pending,status:'CLOSED',adminActivityAt:'2026-10-12T12:01:00Z',updateRespondedAt:'2026-10-12T12:01:00Z'}).map(n=>n.kind)).toEqual(['closed']);
});
