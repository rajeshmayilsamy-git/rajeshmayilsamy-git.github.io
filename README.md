# rajeshmayilsamy.xyz

Personal site for Rajesh Mayilsamy — MSc Aeronautical Engineering, Linköping University.
CFD, turbomachinery, gas turbines and aircraft conceptual design.

Plain HTML, CSS and JavaScript. No build step, no frameworks, no 3D libraries: edit the files and push.

| file | what it is |
| --- | --- |
| `index.html` | all page content |
| `style.css` | all styling |
| `main.js` | page behaviour, plus the background airflow and the morphing body in the hero |
| `flow.js` | the airflow solver (a 2D potential-flow panel method) and the shape definitions |
| `assets/projects/` | figures and video shown on the project cards |
| `assets/Rajesh_Mayilsamy_CV.pdf` | the CV behind the Resume link and download icon |
| `CNAME` | the custom domain; deleting it reverts the site to the github.io address |

## How the hero works

The glowing body morphs sphere → airfoil → turbine blade → F1 car → rhombus → wedge → sphere.
Every purple streak is a particle carried by the ideal potential flow around whatever shape is on
screen. `flow.js` re-solves that flow as the shape morphs; a sharp trailing edge (airfoil, blade)
gets circulation from the Kutta condition. The F1 outline is traced from a side-view silhouette.
The same explanation, in plain words, is in the "How this page works" tab on the page.

## Visit analytics

Off by default. Put a GoatCounter site code in `GOATCOUNTER` at the top of `main.js` to turn it on.
GoatCounter sets no cookies and collects no personal data.

## Running it locally

    python -m http.server 8000

then open <http://localhost:8000>. Opening `index.html` straight off disk will not work,
because the scripts are ES modules.
