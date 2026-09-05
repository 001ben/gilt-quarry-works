"""Author GILT's original game-ready machinery. Run with Blender --background --python."""
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0, roughness=.5):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m

yellow = material('Saffron enamel', (.95,.53,.065), .45,.3)
light = material('Warm ivory', (.87,.84,.65), .2,.42)
dark = material('Pine steel', (.065,.12,.10), .65,.36)
rubber = material('Graphite treads', (.055,.065,.06), .12,.75)
steel = material('Brushed cutting steel', (.32,.38,.37), .8,.27)
glass = material('Smoked teal glazing', (.06,.26,.27), .65,.17)
orange = material('Amber beacon', (1,.24,.015), .2,.2)
bsdf = orange.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Emission Color'].default_value = (1,.15,.005,1)
bsdf.inputs['Emission Strength'].default_value = .8

def group(name):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    return ob

chassis = group('Chassis')
blade = group('Blade')
left = group('Wing_L')
right = group('Wing_R')

def finish(ob, name, mat, parent, bevel=0):
    ob.name=name
    ob.data.materials.append(mat)
    ob.parent=parent
    if bevel:
        mod=ob.modifiers.new('Machined edges','BEVEL'); mod.width=bevel; mod.segments=2
        ob.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return ob

def box(name, loc, size, mat, parent=chassis, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob=bpy.context.object; ob.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob,name,mat,parent,bevel)

def cylinder(name, loc, radius, depth, mat, parent=chassis, rotation=(0,0,0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    return finish(bpy.context.object,name,mat,parent,.025)

def bar(name, start, end, radius, mat, parent=chassis):
    delta=Vector(end)-Vector(start)
    ob=cylinder(name,(Vector(start)+Vector(end))/2,radius,delta.length,mat,parent)
    ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return ob

# Articulated-looking tracked undercarriage, with deliberately legible individual shoes.
box('Armoured belly',(0,0,.52),(1.5,2.6,.45),dark)
for side in [-1,1]:
    x=side*1.0
    box('Track belt',(x,0,.5),(.55,2.9,.85),rubber,bevel=.24)
    for y in [-.96,-.48,0,.48,.96]:
        cylinder('Road wheel',(x+side*.29,y,.51),.31,.08,steel,rotation=(0,math.pi/2,0))
        cylinder('Wheel hub',(x+side*.34,y,.51),.12,.09,yellow,rotation=(0,math.pi/2,0))
    for i in range(13):
        y=-1.25+i*.208
        for z in [.11,.91]:
            box('Track shoe',(x,y,z),(.66,.16,.095),rubber,bevel=.015)
    for y in [-1.42,1.42]:
        for z in [.33,.55,.76]: box('Curved track shoe',(x,y,z),(.64,.08,.15),rubber,bevel=.02)

box('Lower body',(0,-.12,1.05),(1.7,2.35,.48),yellow,bevel=.12)
box('Engine hood',(0,.7,1.41),(1.4,1.0,.45),yellow,bevel=.12)
box('Bonnet centre stripe',(0,.71,1.648),(.22,.81,.014),dark,bevel=.01)
for i in range(7): box('Cooling grille',(-.49+i*.163,1.215,1.42),(.07,.025,.28),dark,bevel=.01)
box('Rear counterweight',(0,-1.26,1.04),(1.86,.35,.65),dark,bevel=.12)
box('Cab glazing',(0,-.45,1.78),(1.26,1.04,1.04),glass,bevel=.1)
for x in [-.68,.68]:
    for y in [-1.02,.12]: bar('Safety cage',(x,y,1.22),(x,y,2.37),.055,dark)
box('Floating canopy',(0,-.45,2.39),(1.66,1.49,.16),light,bevel=.075)
box('Canopy stripe',(0,-.45,2.482),(.2,1.25,.025),yellow,bevel=.01)
cylinder('Beacon foot',(.48,-.57,2.53),.13,.1,dark)
cylinder('Beacon',(.48,-.57,2.67),.115,.19,orange)
cylinder('Exhaust',(-.53,.51,1.95),.07,1.1,dark)
cylinder('Exhaust cap',(-.53,.51,2.5),.11,.06,steel)
for x in [-.68,.68]:
    box('Headlight housing',(x,.97,1.71),(.24,.23,.18),dark)
    box('Headlight lens',(x,1.096,1.72),(.18,.018,.1),light,bevel=.015)
    bar('Hydraulic cylinder',(x,.22,.65),(x,1.63,.52),.09,dark)
    bar('Hydraulic piston',(x,1.1,.56),(x,2.08,.4),.055,steel)
    box('Step',(x*1.1,-.89,1.1),(.35,.35,.1),steel)

# Swept concave blade, open toward Blender +Y (glTF -Z).
profile=[(2.18,.16),(2.01,.32),(1.91,.61),(1.96,.9),(2.10,1.12)]
verts=[]
for x in [-1.6,1.6]:
    for y,z in profile: verts.append((x,y,z))
faces=[(i,i+1,i+6,i+5) for i in range(4)]
mesh=bpy.data.meshes.new('Rolled blade mesh'); mesh.from_pydata(verts,[],faces); mesh.update()
ob=bpy.data.objects.new('Rolled concave blade',mesh); bpy.context.collection.objects.link(ob)
finish(ob,ob.name,yellow,blade)
solid=ob.modifiers.new('Plate thickness','SOLIDIFY'); solid.thickness=.09
bevel=ob.modifiers.new('Safe edges','BEVEL'); bevel.width=.025; bevel.segments=2
box('Replaceable cutting edge',(0,2.2,.17),(3.3,.16,.16),steel,blade,.025)
box('Blade top rail',(0,2.1,1.12),(3.3,.14,.1),dark,blade,.025)
for x in [-1.25,-.63,0,.63,1.25]:
    box('Blade rib',(x,1.86,.63),(.075,.12,.72),yellow,blade,.02)
    tooth=box('Cutting tooth',(x,2.31,.13),(.17,.36,.16),steel,blade,.02)
    tooth.rotation_euler.x=-.15
    cylinder('Blade bolt',(x,2.292,.22),.033,.025,dark,blade,(math.pi/2,0,0),8)
for side, parent in [(-1,left),(1,right)]:
    ob=box('Funnel wing',(side*1.81,2.48,.61),(.12,.91,.94),yellow,parent,.055)
    ob.rotation_euler.z=-side*.4
    ob=box('Wing cutting rail',(side*1.82,2.51,.18),(.17,.96,.12),steel,parent,.02)
    ob.rotation_euler.z=-side*.4

# Include a reproducible asset-review setup in the editable Blender source.
world=bpy.context.scene.world
world.color=(.2,.2,.2)
bpy.ops.object.light_add(type='AREA',location=(4,-4,8)); bpy.context.object.data.energy=1600; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=7
bpy.ops.object.camera_add(location=(6,8,5.2))
camera=bpy.context.object; camera.rotation_euler=(Vector((0,.2,1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=7.6; bpy.context.scene.camera=camera
bpy.context.scene.render.engine='CYCLES'; bpy.context.scene.cycles.samples=32
bpy.context.scene.render.resolution_x=1100; bpy.context.scene.render.resolution_y=850; bpy.context.scene.render.resolution_percentage=100
bpy.context.scene.render.film_transparent=True
os.makedirs(os.path.join(ROOT,'public','models'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','gilt-dozer.blend'))
bpy.ops.object.select_all(action='DESELECT')
for parent in [chassis,blade,left,right]:
    parent.select_set(True)
    for ob in parent.children_recursive: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','gilt-dozer.glb'),export_format='GLB',use_selection=True,export_apply=True)
bpy.context.scene.render.filepath=os.path.join(ROOT,'art','dozer-preview.png')
bpy.ops.render.render(write_still=True)
