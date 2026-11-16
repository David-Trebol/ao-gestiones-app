from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import os
OUT=os.path.dirname(os.path.abspath(__file__))
W,H=A4

def cif(letter, digits7):
    s=0
    for i,ch in enumerate(digits7):
        d=int(ch)
        if i%2==0:
            d*=2
            if d>9: d-=9
        s+=d
    c=(10-s%10)%10
    if letter in 'PQRSNW': return f"{letter}{digits7}{'JABCDEFGHI'[c]}"
    return f"{letter}{digits7}{c}"
def eur(n):
    s=f"{n:,.2f}"
    return s.replace(',','X').replace('.',',').replace('X','.')

ISS=cif('B','9612345'); CLI=cif('A','2876543'); AO=cif('B','1234567')
print('CIFs', ISS, CLI, AO)

def table(c, y, cols, rows, font=9):
    # cols: list of (title, x, align)
    c.setFont('Helvetica-Bold', font)
    for t,x,al in cols:
        (c.drawRightString if al=='r' else c.drawString)(x,y,t)
    c.line(20*mm, y-2*mm, W-20*mm, y-2*mm)
    y-=7*mm
    c.setFont('Helvetica', font)
    for r in rows:
        lines=r
        for k,(t,x,al) in enumerate(cols):
            v=r[k]
            if isinstance(v,list):
                for j,vv in enumerate(v):
                    c.drawString(x,y-j*4.2*mm,vv)
            elif v!='':
                (c.drawRightString if al=='r' else c.drawString)(x,y,v)
        extra=max([len(v) for v in r if isinstance(v,list)] or [1])
        y-=(5.2 + (extra-1)*4.2)*mm
    return y

# ---------- 1. Factura de proveedor a cliente
def factura(path):
    c=canvas.Canvas(path,pagesize=A4)
    c.setFont('Helvetica-Bold',14); c.drawString(20*mm,H-22*mm,'Suministros Industriales Levante S.L.')
    c.setFont('Helvetica',9)
    for i,t in enumerate(['Avda. del Puerto, 214 - Nave 3','46023 Valencia','Tel. 963 456 789 · info@silevante.es',f'CIF: {ISS}']):
        c.drawString(20*mm,H-(28+i*4.5)*mm,t)
    c.setFont('Helvetica-Bold',18); c.drawRightString(W-20*mm,H-22*mm,'FACTURA')
    c.setFont('Helvetica',9)
    c.drawString(120*mm,H-32*mm,'Nº Factura: FV-2026-0142')
    c.drawString(120*mm,H-37*mm,'Fecha: 14/10/2026')
    c.drawString(120*mm,H-42*mm,'Su pedido: PC-7781')
    # cliente
    c.rect(118*mm,H-85*mm,72*mm,38*mm)
    c.setFont('Helvetica-Bold',9); c.drawString(120*mm,H-52*mm,'Cliente:')
    c.setFont('Helvetica',9)
    for i,t in enumerate(['Talleres Martínez S.A.','Att. Laura Gómez','C/ Alcalá, 155, 3º Izda.','28009 Madrid','Tel. 914 112 233 / 600 123 456','compras@talleresmartinez.es',f'NIF: {CLI}']):
        c.drawString(120*mm,H-(57+i*4.3)*mm,t)
    cols=[('Código',20*mm,'l'),('Descripción',45*mm,'l'),('Cant.',125*mm,'r'),('Precio',145*mm,'r'),('Dto.%',160*mm,'r'),('Importe',190*mm,'r')]
    rows=[
      ['RD-6205','Rodamiento rígido de bolas 6205 2RS','10',eur(4.85),'','48,50'],
      ['CR-1200',['Correa trapezoidal SPA 1200','perfil reforzado, caja de 5'],'4',eur(18.40),'10',eur(4*18.40*0.9)],
      ['MT-0750','Motor trifásico 0,75 kW 1500 rpm','1',eur(1250.00),'5',eur(1250*0.95)],
      ['TN-M8','Tornillo DIN 933 M8x30 (caja 100)','3',eur(12.30),'',eur(36.90)],
      ['','Portes y embalaje','1',eur(25.00),'',eur(25.00)],
    ]
    y=table(c,H-100*mm,cols,rows)
    base=48.50+round(4*18.40*0.9,2)+1250*0.95+36.90+25
    iva=round(base*0.21,2)
    y-=8*mm
    c.setFont('Helvetica',10)
    c.drawString(120*mm,y,'Base imponible'); c.drawRightString(190*mm,y,eur(base)+' €'); y-=6*mm
    c.drawString(120*mm,y,'IVA 21%'); c.drawRightString(190*mm,y,eur(iva)+' €'); y-=6*mm
    c.setFont('Helvetica-Bold',11); c.drawString(120*mm,y,'TOTAL FACTURA'); c.drawRightString(190*mm,y,eur(base+iva)+' €')
    c.setFont('Helvetica',8)
    c.drawString(20*mm,40*mm,'Forma de pago: Transferencia a 30 días')
    c.drawString(20*mm,35*mm,'Plazo de entrega: 7 días laborables')
    c.drawString(20*mm,15*mm,f'Suministros Industriales Levante S.L. · Inscrita en el Registro Mercantil de Valencia, Tomo 9876, Folio 12, Hoja V-55555 · CIF {ISS}')
    c.save(); return base,iva
print('factura', factura(f'{OUT}/01-factura-proveedor.pdf'))

# ---------- 2. Pedido de compra del cliente (2 páginas, muchas líneas)
def pedido(path):
    c=canvas.Canvas(path,pagesize=A4)
    def head(pg):
        c.setFont('Helvetica-Bold',13); c.drawString(20*mm,H-20*mm,'Construcciones Ebro Norte S.L.')
        c.setFont('Helvetica',9)
        c.drawString(20*mm,H-26*mm,'Polígono Malpica, Calle E, nave 12')
        c.drawString(20*mm,H-30.5*mm,'50016 Zaragoza')
        c.drawString(20*mm,H-35*mm,f'CIF B{"5"}0998877'.replace('B50998877',cif('B','5099887')))
        c.drawString(20*mm,H-39.5*mm,'Tel. 976 001 122 · pedidos@ebronorte.com')
        c.setFont('Helvetica-Bold',15); c.drawRightString(W-20*mm,H-20*mm,'PEDIDO DE COMPRA')
        c.setFont('Helvetica',9)
        c.drawRightString(W-20*mm,H-27*mm,'Nº Pedido: 2026/0458')
        c.drawRightString(W-20*mm,H-32*mm,'Fecha: 22/10/2026')
        c.drawRightString(W-20*mm,H-37*mm,f'Página {pg} de 2')
    head(1)
    c.setFont('Helvetica-Bold',9); c.drawString(20*mm,H-52*mm,'Proveedor:')
    c.setFont('Helvetica',9)
    for i,t in enumerate(['AO Gestiones','Calle Mayor 10','03001 Alicante',f'CIF {AO}']):
        c.drawString(20*mm,H-(57+i*4.3)*mm,t)
    cols=[('Ref.',20*mm,'l'),('Descripción',45*mm,'l'),('Uds.',140*mm,'r'),('P. unit.',162*mm,'r'),('Importe',190*mm,'r')]
    import random
    random.seed(4)
    items=[]
    for k in range(34):
        q=random.choice([1,2,5,10,20,50,100]); p=round(random.uniform(0.5,180),2)
        items.append([f'EB-{1000+k}',f'Material de obra referencia larga número {k+1} acabado galvanizado',str(q),eur(p),eur(q*p)])
    total=round(sum(float(i[4].replace('.','').replace(',','.')) for i in items),2)
    y=table(c,H-82*mm,cols,items[:24])
    c.showPage(); head(2)
    y=table(c,H-55*mm,cols,items[24:])
    y-=6*mm
    c.setFont('Helvetica-Bold',10); c.drawString(120*mm,y,'Total sin IVA'); c.drawRightString(190*mm,y,eur(total))
    c.setFont('Helvetica',8); c.drawString(20*mm,25*mm,'Condiciones de pago: Confirming 60 días. Portes: pagados')
    c.save(); return total
print('pedido', pedido(f'{OUT}/02-pedido-cliente-2-paginas.pdf'))

# ---------- 3. Oferta dos columnas sin etiqueta, con IVA al pie
def oferta(path):
    c=canvas.Canvas(path,pagesize=A4)
    c.setFont('Helvetica-Bold',12); c.drawString(20*mm,H-20*mm,'Mobiliario Técnico Sur, S.L.')
    c.setFont('Helvetica',9)
    for i,t in enumerate(['C/ Industria 7','41006 Sevilla',f'CIF: {cif("B","4155667")}','ventas@mtsur.es']):
        c.drawString(20*mm,H-(26+i*4.3)*mm,t)
    for i,t in enumerate(['Clínica Dental Arenal SL','Plaza Nueva 3, 1º','29001 Málaga','Tel: 952 334 455',f'NIF {cif("B","2933445")}']):
        c.drawString(125*mm,H-(26+i*4.3)*mm,t)
    c.setFont('Helvetica-Bold',14); c.drawString(20*mm,H-58*mm,'PRESUPUESTO Nº P-26-0093')
    c.setFont('Helvetica',9); c.drawString(20*mm,H-63*mm,'Fecha: 3 de octubre de 2026')
    cols=[('Ref',20*mm,'l'),('Descripción',40*mm,'l'),('Uds',130*mm,'r'),('P.Unit',155*mm,'r'),('Total',190*mm,'r')]
    rows=[['SIL-01','Sillón dental ergonómico','2',eur(3450.00),eur(6900.00)],
          ['LAM-22','Lámpara LED quirúrgica','2',eur(890.00),eur(1780.00)],
          ['TAB-05','Taburete con respaldo','4',eur(145.50),eur(582.00)],
          ['TAB-05','Taburete con respaldo','4',eur(145.50),eur(582.00)]]
    y=table(c,H-75*mm,cols,rows)
    base=6900+1780+582*2
    y-=8*mm
    c.drawString(120*mm,y,'Subtotal'); c.drawRightString(190*mm,y,eur(base)); y-=5*mm
    c.drawString(120*mm,y,'IVA (21%)'); c.drawRightString(190*mm,y,eur(round(base*.21,2))); y-=5*mm
    c.drawString(120*mm,y,'Total'); c.drawRightString(190*mm,y,eur(round(base*1.21,2)))
    c.drawString(20*mm,30*mm,'Validez de la oferta: 30 días. Entrega: 3-4 semanas')
    c.save(); return base
print('oferta', oferta(f'{OUT}/03-presupuesto-dos-columnas.pdf'))
