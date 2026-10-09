export interface Example {
  id: string
  /** English name (a key in the UK dictionary). */
  name: string
  netlist: string
}

export const EXAMPLES: Example[] = [
  {
    id: 'rc-ac',
    name: 'RC low-pass filter (.ac)',
    netlist: `RC low-pass filter, corner at 1/(2*pi*R*C) = 1.59 kHz
* AC sweep from 10 Hz to 1 MHz, 20 points per decade
V1 in 0 DC 0 AC 1
R1 in out 1k
C1 out 0 100n
.ac dec 20 10 1meg
.end
`,
  },
  {
    id: 'rlc-tran',
    name: 'Series RLC step response (.tran)',
    netlist: `Series RLC ringing, f0 = 1/(2*pi*sqrt(L*C)) = 5.03 kHz
* Underdamped: R = 20 ohm is far below 2*sqrt(L/C) = 632 ohm (zeta = 0.03)
V1 in 0 PULSE(0 5 0 1n 1n 5m 10m)
R1 in n1 20
L1 n1 out 10m
C1 out 0 100n
.tran 2u 2m
.end
`,
  },
  {
    id: 'rectifier',
    name: 'Diode rectifier with filter (.tran)',
    netlist: `Half-wave rectifier with smoothing capacitor
V1 in 0 SIN(0 10 50)
D1 in out DMOD
C1 out 0 100u
R1 out 0 1k
.model DMOD D(IS=1e-14 N=1.05 RS=0.5 CJO=10p)
.tran 50u 100m
.end
`,
  },
  {
    id: 'bjt-ce',
    name: 'BJT common-emitter amplifier (.ac)',
    netlist: `BJT common-emitter amplifier, voltage divider bias
VCC vcc 0 DC 12
VIN src 0 DC 0 AC 1m SIN(0 1m 1k)
RS src b1 600
C1 b1 b 10u
R1 vcc b 47k
R2 b 0 10k
RC vcc c 2.2k
RE e 0 1k
CE e 0 100u
Q1 c b e QN2222
C2 c out 10u
RL out 0 10k
.model QN2222 NPN(IS=1e-14 BF=200 VAF=100 CJE=20p CJC=8p TF=0.4n RB=10)
.ac dec 20 10 100meg
.end
`,
  },
  {
    id: 'mos-dc',
    name: 'MOSFET inverter transfer curve (.dc)',
    netlist: `NMOS inverter with resistive load, DC transfer curve
VDD vdd 0 DC 5
VIN in 0 DC 0
RD vdd out 10k
M1 out in 0 0 NM W=20u L=1u
.model NM NMOS(LEVEL=1 VTO=1 KP=100u LAMBDA=0.02)
.dc VIN 0 5 0.05
.end
`,
  },
  {
    id: 'divider-op',
    name: 'Voltage divider (.op)',
    netlist: `Resistive divider operating point
V1 in 0 DC 9
R1 in mid 2k
R2 mid 0 1k
.op
.end
`,
  },
  {
    id: 'astable',
    name: 'Transistor astable multivibrator (.tran)',
    netlist: `Two-transistor astable multivibrator, period about 1.4*R*C
VCC vcc 0 DC 5
RC1 vcc c1 1k
RC2 vcc c2 1k
RB1 vcc b1 47k
RB2 vcc b2 47k
C1 c1 b2 10n
C2 c2 b1 10n
Q1 c1 b1 0 QSW
Q2 c2 b2 0 QSW
.model QSW NPN(IS=1e-14 BF=100 TF=0.3n CJE=2p CJC=2p)
.ic v(c1)=0 v(c2)=5
.tran 2u 2m uic
.end
`,
  },
]

export const DEFAULT_EXAMPLE = EXAMPLES[0]
