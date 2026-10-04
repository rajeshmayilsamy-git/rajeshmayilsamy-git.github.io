# rajeshmayilsamy-git.github.io

Personal site for Rajesh Mayilsamy — MSc Aeronautical Engineering, Linköping University.
CFD, turbomachinery, gas turbines and aircraft conceptual design.

Plain HTML, CSS and JavaScript. No build step: edit the files and push.

| file | what it is |
| --- | --- |
| `index.html` | all page content |
| `style.css` | all styling |
| `main.js` | the WebGL turbine, the flow-field background and the portrait cut-out |
| `assets/photo.jpg` | source portrait; the white backdrop is keyed out in the browser |
| `assets/projects/` | figures shown on the project cards |

Three.js is loaded from a CDN, so the page needs an internet connection.

## Running it locally

    python -m http.server 8000

then open <http://localhost:8000>. Opening `index.html` straight off disk will not
work, because the page is an ES module and the portrait reads image pixels.
