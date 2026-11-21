#!/usr/bin/env python3
"""Bakes the NPC voice files for U33.

Raw ElevenLabs clips live in assets/voice-src/NNN.mp3 (line 251 has 251_female.mp3 and 251_male.mp3).
Output: assets/voice/NNN.mp3 (in person) and assets/voice/comms/NNN.mp3 (heard over comms), both mono 64 kbps, levelled to -18 LUFS.
Each speaker's treatment is the one Bryce approved by ear (docs/U33_PROPOSAL.md). Change a chain here, then re-run: python3 tools/bake_voices.py [id ...]
Needs ffmpeg. Line text, speaker and ids come from docs/U33_VOICE_MAP.json.
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/voice-src')
OUT = os.path.join(ROOT, 'assets/voice')
MAP = json.load(open(os.path.join(ROOT, 'docs/U33_VOICE_MAP.json'), encoding='utf-8'))
TARGET, TP = -18.0, -2.0

def pitch(p):  # pitch shift with the speaking speed kept
    return f'asetrate=44100*{p},aresample=44100,atempo={round(1 / p, 4)}'

# speaker -> (ring-mod sine Hz or None, filter graph from [0:a] (and [1:a] if a sine is used) to the output)
def ghost():
    return 110, "[0:a]asplit[d][w];[w][1:a]amultiply,highpass=f=350,lowpass=f=5000,acrusher=bits=8:mode=lin:mix=0.6[r];[d]highpass=f=200,lowpass=f=5500,acrusher=bits=11:mix=0.3[dd];[dd][r]amix=inputs=2:weights=0.35 1:normalize=0,flanger=delay=3:depth=2:speed=0.4:width=70,aecho=0.8:0.7:15|27|41:0.35|0.25|0.15,volume=1.6,alimiter=limit=0.9"
def kadi():
    return 230, "[0:a]asplit[d][w];[w][1:a]amultiply,highpass=f=500,lowpass=f=7000,acrusher=bits=7:mode=log:mix=0.5[r];[d]highpass=f=300,treble=g=4[dd];[dd][r]amix=inputs=2:weights=0.5 0.9:normalize=0,vibrato=f=6:d=0.15,aecho=0.8:0.5:6|11:0.3|0.2,volume=1.6,alimiter=limit=0.9"
def rasputin():
    return 48, "[0:a]asetrate=44100*0.82,aresample=44100,asplit[d][w];[w][1:a]amultiply,highpass=f=120,lowpass=f=3500,acrusher=bits=9:mode=lin:mix=0.4[r];[d]lowpass=f=4200,highpass=f=80[dd];[dd][r]amix=inputs=2:weights=1 0.7:normalize=0,volume=1.5,alimiter=limit=0.9"
def cayde():
    return 180, f"[0:a]{pitch(1.05)},asplit[d][w];[w][1:a]amultiply,highpass=f=300,lowpass=f=5500,acrusher=bits=8:mode=lin:mix=0.5[r];[d]highpass=f=120,lowpass=f=7000[dd];[dd][r]amix=inputs=2:weights=0.7 0.9:normalize=0,aecho=0.9:0.6:4|8|13:0.35|0.25|0.18,volume=1.4,alimiter=limit=0.9"
def riven():
    return None, "[0:a]apad=pad_dur=2.5,asplit=3[a][b][c];[a]highpass=f=150,deesser=i=0.5:m=0.5:f=0.5,volume=0.8[dry];[b]highpass=f=200,deesser=i=0.8:m=0.6:f=0.55,lowpass=f=2800,chorus=0.6:0.9:45|65:0.4|0.3:0.25|0.4:2|1.3,aecho=0.8:0.88:110|210|330|470|650:0.4|0.35|0.3|0.22|0.14,lowpass=f=3200,adelay=160|160,volume=0.95[rev];[c]asetrate=44100*2,aresample=44100,atempo=0.5,highpass=f=900,deesser=i=0.8:m=0.6:f=0.5,lowpass=f=2400,chorus=0.6:0.9:50|70:0.4|0.3:0.25|0.4:2|1.3,aecho=0.8:0.8:140|280:0.35|0.25,adelay=240|240,volume=0.3[sh];[dry][rev][sh]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.85"
def crota():
    return None, "[0:a]apad=pad_dur=2,asetrate=44100*0.78,aresample=44100,atempo=1.2821,asplit=2[a][b];[a]lowpass=f=5500[dry];[b]asetrate=44100*0.5,aresample=44100,atempo=2.0,lowpass=f=900,volume=0.5[sub];[dry][sub]amix=inputs=2:duration=first:normalize=0,aecho=0.8:0.8:80|160|280|430:0.4|0.32|0.24|0.15,alimiter=limit=0.9"
def plain(p=None):
    return None, f"[0:a]{pitch(p)}" if p else "[0:a]anull"

FX = {
    'GHOST': ghost, 'KADI 55-30': kadi, 'RASPUTIN': rasputin, 'CAYDE-6': cayde, 'RIVEN': riven, 'CROTA': crota,
    'ZAVALA': lambda: plain(0.94), 'EMPEROR CALUS': lambda: plain(0.80),
}
NO_COMMS = {'GHOST', 'RIVEN', 'PSION HERALD'}  # never over comms (Ghost is always with you, Riven speaks in the mind, the Herald is a chorus)

# Psion Herald: seven stereo-panned copies of two takes, a faint hall, no comms.
def psion_filter():
    df, dm = 9.168980, 10.762449
    V = [('f', 1.00, 10.00, 0, -0.1), ('f', 1.03, 10.15, 40, -0.7), ('f', 0.97, 9.90, 75, 0.7), ('m', 1.00, 10.08, 20, 0.1), ('m', 0.95, 9.95, 55, 0.9), ('m', 1.04, 10.20, 95, -0.9), ('m', 0.88, 10.02, 35, 0.4)]
    nf = sum(1 for v in V if v[0] == 'f'); nm = len(V) - nf
    c = f"[0:a]asplit={nf}{''.join(f'[f{i}]' for i in range(nf))};[1:a]asplit={nm}{''.join(f'[m{i}]' for i in range(nm))};"
    ci = {'f': 0, 'm': 0}
    for k, (w, p, T, dl, pan) in enumerate(V):
        d = df if w == 'f' else dm
        lab = f'{w}{ci[w]}'; ci[w] += 1
        gl = round(min(1, 1 - pan) * 0.6, 3); gr = round(min(1, 1 + pan) * 0.6, 3)
        c += f"[{lab}]asetrate=44100*{p},aresample=44100,atempo={d / (p * T):.4f},adelay={dl}|{dl},pan=stereo|c0={gl}*c0|c1={gr}*c0[v{k}];"
    return c + ''.join(f'[v{k}]' for k in range(len(V))) + f"amix=inputs={len(V)}:duration=longest:normalize=0,aecho=0.8:0.85:70|150:0.2|0.12,alimiter=limit=0.9,pan=mono|c0=0.5*c0+0.5*c1"

COMMS = "[0:a]highpass=f=650,lowpass=f=3200,agate=threshold=0.004:ratio=1.5:attack=5:release=200,volume=2.0[v];[1:a]highpass=f=800,lowpass=f=5000,tremolo=f=9:d=0.5,volume=0.08[n];[v][n]amix=inputs=2:duration=first:weights=1 1:normalize=0,adelay=120|120,alimiter=limit=0.9"

def ff(args):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + args, check=True)

def level(src, dst):
    """Two-pass loudnorm (linear) to the target, then a small mono mp3."""
    p = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', f'loudnorm=I={TARGET}:TP={TP}:LRA=7:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(p[p.rindex('{'):p.rindex('}') + 1])
    flt = f"loudnorm=I={TARGET}:TP={TP}:LRA=7:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=44100"
    ff(['-i', src, '-af', flt, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', dst])

def run_graph(inputs, graph, dst, sine=None):
    args = []
    for i in inputs: args += ['-i', i]
    if sine: args += ['-f', 'lavfi', '-i', f'sine=frequency={sine}:sample_rate=44100']
    ff(args + ['-filter_complex', graph, '-ar', '44100', '-ac', '1', dst])

def bake(n, tmp):
    sp = MAP[n]['speaker']
    if sp == 'PSION HERALD':
        run_graph([f'{SRC}/{n}_female.mp3', f'{SRC}/{n}_male.mp3'], psion_filter(), f'{tmp}/{n}.wav')
    else:
        sine, g = FX.get(sp, lambda: plain())()
        run_graph([f'{SRC}/{n}.mp3'], g if ';' in g else g + ',anull', f'{tmp}/{n}.wav', sine)
    os.makedirs(OUT, exist_ok=True)
    level(f'{tmp}/{n}.wav', f'{OUT}/{n}.mp3')
    if sp not in NO_COMMS:
        os.makedirs(f'{OUT}/comms', exist_ok=True)
        ff(['-i', f'{tmp}/{n}.wav', '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.5:sample_rate=44100', '-filter_complex', COMMS, '-ar', '44100', '-ac', '1', f'{tmp}/{n}_c.wav'])
        level(f'{tmp}/{n}_c.wav', f'{OUT}/comms/{n}.mp3')

if __name__ == '__main__':
    ids = sys.argv[1:] or sorted(MAP)
    with tempfile.TemporaryDirectory() as tmp:
        for n in ids:
            bake(n, tmp)
            print('baked', n, MAP[n]['speaker'], flush=True)
