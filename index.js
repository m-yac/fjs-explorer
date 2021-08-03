
// ================================================================
// Utility functions
// ================================================================

const tt = microtonal_utils.Interval(2).sqrt();
const primesGt5 = microtonal_utils.Interval([0,0].concat(Array(16).fill(1)))
                                  .factors().map(f => f[0]);

function toRatioStr(fr) {
  return (fr.s * fr.n) + "/" + fr.d;
}

function reformatURL(str) {
  // encode a couple more characters from RFC 3986
  // (adapted from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent)
  str = str.replaceAll(/[!']/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
  // encode spaces as "+"s
  str = str.replaceAll(/%20/gi, "+");
  // un-encode some characters for nicer-to-read URLs
  ['/','-','^',','/*,'[',']','|','<','>'*/].forEach(function (c) {
    const pat = new RegExp('%' + c.charCodeAt(0).toString(16), 'gi');
    str = str.replaceAll(pat, c);
  })
  return str;
}

function fmtXenCalcLink(str) {
  return "https://www.yacavone.net/xen-calc/?q=" + reformatURL(encodeURIComponent(str));
}

// ================================================================
// State variables
// ================================================================

const rotPresets = [
  ["Standard FJS",      "65/63"],
  // ["Rejected std. FJS", "sqrt(256/243)"],
  ["FloraC",           "sqrt(2187/2048)"],
  ["Neutral FJS",       "sd2"]
];
var rotPreset = 1;

const fifthSeqPresets = [
  ["Standard FJS", microtonal_utils.fjsFifthSeq,
   "0, 1, -1, 2, -2, 3, -3, ..."],
  ["Neutral FJS", microtonal_utils.nfjsFifthSeq,
   "0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 1/2, -1/2, 3/2, -3/2, 5/2, -5/2, 7/2, -7/2, 9/2, -9/2, 11/2, -11/2"]
]
var fifthSeqPreset = 1;

var spec = microtonal_utils.FJSLike(microtonal_utils.fjsRoT, microtonal_utils.fjsFifthSeq, true, true);
var regions;

const visRegionColors =
  // ["#FF7E79", "#FFD479", "#FFFC8C"];
  ["#FF7878", "#FFD479", "#78A6FF"];
var visRegionIDs;

// ================================================================
// Formatting functions
// ================================================================

// Focuses '#expr' and adds the given string at the current cursor position
function insertAtCursor(str) {
  $('#expr').focus();
  const caret = $('#expr')[0].selectionStart;
  const curr_val = $('#expr').val();
  $('#expr').val(curr_val.slice(0,caret) + str + curr_val.slice(caret));
  $('#expr')[0].selectionStart = caret + str.length;
  $('#expr')[0].selectionEnd   = caret + str.length;
}

// Given an array `[n, edo]` returns the string "n\edo"
function fmtEDOStep(step) {
  return step[0] + "\\" + step[1];
}

// Given a value in cents, a number of decimal places, and a boolean indicating
//  whether to add trailing zeros, return the value truncated to the given
//  number of decimal places followed by trailing zeros if the boolean is set
//  and the letter "c".
function fmtCents(cents, decimalPlaces, trailingZeros) {
  if (trailingZeros) { return  cents.toFixed(decimalPlaces) + "c"; }
  else               { return +cents.toFixed(decimalPlaces) + "c"; }
}

// Given a value in hertz, a number of decimal places, and a boolean indicating
//  whether to add trailing zeros, return the value truncated to the given
//  number of decimal places followed by trailing zeros if the boolean is set
//  and the letters "Hz".
function fmtHertz(cents, decimalPlaces, trailingZeros) {
  if (trailingZeros) { return  cents.toFixed(decimalPlaces) + "Hz"; }
  else               { return +cents.toFixed(decimalPlaces) + "Hz"; }
}

// Given an interval, returns its factorization as a string
function fmtFactorization(intv) {
  let [fact_off, fact_on] = [[], []];
  for (const [p,e] of intv.factors()) {
    if (e.equals(1)) {
      fact_off.push(p);
      fact_on.push(p);
    }
    else if (e.d == 1) {
      fact_off.push(p + "<sup>" + (e.s*e.n) + "</sup>");
      fact_on.push(p + "^" + (e.s*e.n));
    }
    else {
      fact_off.push(p + "<sup>" + e.toFraction() + "</sup>")
      fact_on.push(p + "^(" + e.toFraction() + ")");
    }
  }
  return [fact_off.join(" * "), fact_on.join(" * ")];
}

// Given an interval, returns it formatted as a ratio if it's a ratio, an
//  nth root if its an nth root for n <= 6 or n equal to the second argument, or
//  otherwise its factorization
function fmtExpression(intv, prefEDO) {
  try {
    if (intv.toNthRoot().n <= 6) {
      const nthRootStr = intv.toNthRootString();
      return [nthRootStr, nthRootStr];
    }
  }
  catch (err) {}
  return fmtFactorization(intv);
}

// Wrap a given string in an <a> tag formatted with the `expr` class
function fmtExtExprLink(str, linkstr) {
  if (linkstr === undefined) {
    linkstr = str
  }
  const queryStr = reformatURL(encodeURIComponent(linkstr));
  let link = $('<a>').attr("href", "?q=" + queryStr)
                     .attr("style", "vertical-align: top;")
                     .html(str);
  return link;
}

function fmtFifthShiftIdNo(fifthShift) {
  return "" + 4*fifthShift;
}

// ================================================================
// Updating everything
// ================================================================

function changeRoTPreset(i, supressUpdateTables) {
  if (i == undefined) { i = $('#rotPreset').val(); }
  else { $('#rotPreset').val(i); }
  if (i > 0) { changeRoTValue(rotPresets[i-1][1], supressUpdateTables); }
  $('#rot').attr("disabled", i != 0);
}

function changeRoTValue(str, supressUpdateTables) {
  if (str == undefined) { str = $('#rot').val(); }
  else { $('#rot').val(str); }
  try {
    const res = microtonal_utils.parseCvt(str);
    spec.RoT = res.intv;
    if (!supressUpdateTables) { updateTables(); }
    $('#rotXenCalc').attr("href", fmtXenCalcLink(str));
    $('#rotSize').text(fmtCents(res.cents, 3));
    $('#rotSlider').val(res.cents);
    $('#rotErrors').addClass("hidden");
    $('#rot').removeClass("errorInput");
  }
  catch (err) {
    if (err.kind == undefined) {
      newErr = new Error(err.name + (err.message ? "\n" + err.message : ""));
      newErr.stack = err.stack;
      console.error(newErr);
    }
    $('#rotErrors').removeClass("hidden");
    $('#rot').addClass("errorInput");
    const errStr = err.toString().replace("\n","<br>").replace("\\\\","\\");
    $('#rotErrors').html($('<pre>').addClass("parseError").html(errStr));
  }
}

function changeRoTSlider(supressUpdateTables) {
  changeRoTValue($('#rotSlider').val() + "c", supressUpdateTables);
  changeRoTPreset(0, supressUpdateTables);
}

function changeFifthSeq(gen, str, supressUpdateTables) {
  try {
    if (str == undefined) {
      str = $('#fifthSeq').val();
    }
    if (gen == undefined) {
      const gs = str.replace(/\s/g,'').split(",").map(function (s) {
        try {
          const fr = microtonal_utils.Fraction(s);
          if (!(fr.d == 1 || fr.d == 2 || fr.d == 4)) { throw "bad denom"; }
          return fr;
        }
        catch (err) {
          throw new Error("Invalid fifth shift: \"" + s + "\"");
        }
      });
      gen = function* () { yield* gs; };
    }
    else {
      $('#fifthSeq').val(str);
    }
    spec.fifthSeq = gen;
    if (!supressUpdateTables) { updateTables(); }
    $('#fifthSeqErrors').addClass("hidden");
    $('#fifthSeq').removeClass("errorInput");
  }
  catch (err) {
    if (err.kind == undefined) {
      newErr = new Error(err.name + (err.message ? "\n" + err.message : ""));
      newErr.stack = err.stack;
      console.error(newErr);
    }
    $('#fifthSeqErrors').removeClass("hidden");
    $('#fifthSeq').addClass("errorInput");
    const errStr = err.toString().replace("\n","<br>").replace("\\\\","\\");
    $('#fifthSeqErrors').html($('<pre>').addClass("parseError").html(errStr));
  }
}

function changeFifthSeqPreset(i, supressUpdateTables) {
  if (i == undefined) { i = $('#fifthSeqPreset').val(); }
  else { $('#fifthSeqPreset').val(i); }
  if (i > 0) {
    changeFifthSeq(fifthSeqPresets[i-1][1], fifthSeqPresets[i-1][2], supressUpdateTables);
  }
  // if we're on an infinite fifth sequence and changing to a custom one, make
  // it finite based on fjsRegions
  else if ($('#fifthSeq').val().includes("...")) {
    let [gs, remainingRegions] = [[], new Set()];
    regions.forEach(r => remainingRegions.add(fmtFifthShiftIdNo(r.fifthShift)));
    for (const g of spec.fifthSeq()) {
      if (remainingRegions.size == 0) { break; }
      gs.push(g);
      remainingRegions.delete(fmtFifthShiftIdNo(g));
    }
    const str = gs.map(g => g.toFraction()).join(", ");
    changeFifthSeq(function* () { yield* gs; }, str, supressUpdateTables);
  }
  $('#fifthSeq').attr("disabled", i != 0)
}

function updateTables() {
  regions = microtonal_utils.fjsRegions(spec);
  regionHiCents = regions.map(r => ({hi: r.hi.toCents(), fifthShift: r.fifthShift}));
  // get this list of used fifth shifts
  const regionsByIndex = [...regions].sort(function (a,b) {
    return a.index - b.index;
  })
  let visRegions = [];
  for (const {lo,hi,fifthShift} of regionsByIndex) {
    if (fifthShift != undefined && (visRegions.length == 0
        || visRegions[visRegions.length-1].fifthShift != fifthShift)) {
        const i = microtonal_utils.Interval(3,2).pow(fifthShift).red();
        const [min_lo, max_hi] = [i.div(spec.RoT).red(), i.mul(spec.RoT).red()];
        if (min_lo.compare(max_hi) > 0) {
          const [markerLo, markerHi] = i.compare(tt) < 0 ? [i,undefined] : [undefined,i];
          const [colorLo, colorHi] = i.compare(1) == 0 ? [0,0] : [1 + (max_hi.compare(hi) > 0), 1 + (min_lo.compare(lo) < 0)];
          visRegions.push({left: microtonal_utils.Interval(1), width: max_hi, marker: markerLo, fifthShift: fifthShift, color: colorLo});
          visRegions.push({left: min_lo, width: microtonal_utils.Interval(2).div(min_lo), marker: markerHi, fifthShift: fifthShift, color: colorHi});
        }
        else {
          const color = (min_lo.compare(lo) < 0) + (max_hi.compare(hi) > 0);
          // const oldWidth = hi.div(lo);
          // if (lastOldWidth && oldWidth.compare(lastOldWidth) < 0) {
          //   color++;
          // }
          visRegions.push({left: min_lo, width: spec.RoT.pow(2), marker: i, fifthShift: fifthShift, color: color});
          // lastOldWidth = oldWidth;
        }
    }
  }
  visRegions.reverse();
  // update the regions visual
  $('#visualRegions').empty();
  visRegionIDs = {};
  let id = 0;
  for (const {left, width, marker, fifthShift, color} of visRegions) {
    if (fifthShift != undefined) {
      const fifthShiftStr = fmtFifthShiftIdNo(fifthShift);
      let regStyle = "top: " + (5 + color*5) + "px; ";
      regStyle += "left: " + left.valueOf_log()*100 + "%; ";
      regStyle += "width: " + width.valueOf_log()*100 + "%; ";
      regStyle += "background-color: " + visRegionColors[color] + "; "
      let ddReg = $('<dd>').attr("id", "visRegion" + id)
                           .addClass("visRegion")
                           .attr("style", regStyle);
      $('#visualRegions').append(ddReg);
      if (marker) {
        let markerStyle = "top: " + (5 + color*5) + "px; ";
        markerStyle += "left: " + marker.valueOf_log()*100 + "%; ";
        const ddMarker = $('<dd>').addClass("visMarker").attr("style", markerStyle);
        $('#visualRegions').append(ddMarker);
      }
      if (!(fifthShiftStr in visRegionIDs)) { visRegionIDs[fifthShiftStr] = []; }
      visRegionIDs[fifthShiftStr].push("#visRegion" + id);
      id++;
    }
  }
  // add the octave line
  $('#visualRegions').append($('<dd>').addClass("octaveLine"));
  // add the prime/cursor marker
  let ddPrime = $('<dd>').attr("id", "primeMarker")
                         .addClass("primeMarker")
                         .addClass("hidden");
  $('#visualRegions').append(ddPrime);
  $('#visualRegionsContainer').mousemove(function (e) {
    const x = e.pageX - $('#visualRegions').offset().left;
    const width = $('#visualRegions').width();
    const i = microtonal_utils.Interval(2).pow(x/width);
    // for performance's sake, we do approximate comparisons here instead of
    // just calling `microtonal_utils.fjsFifthShift(i, spec)`
    const iCents = i.toCents();
    const fifthShift = regionHiCents.find(r => iCents < r.hi).fifthShift;
    changePrimeMarker(true, i, fifthShift);
  });
  $('#visualRegionsContainer').mouseleave(() => changePrimeMarker(false));
  // update the table of regions
  $('#tableRegions').empty();
  let header = $('<tr>');
  header.append($('<th>').html("Fifth shift"));
  header.append($('<th>').html("Py. Intv."));
  header.append($('<th>').html("Region"));
  $('#tableRegions').append(header);
  for (const {lo,hi,fifthShift,index} of regions) {
    let row = $('<tr>');
    if (fifthShift != undefined) {
      const fifthShiftStr = fmtFifthShiftIdNo(fifthShift);
      let pyi = microtonal_utils.Interval(3,2).pow(fifthShift).red();
      while (lo.div(pyi).compare(tt) > 0) { pyi = pyi.mul(2); }
      while (pyi.div(hi).compare(tt) > 0) { pyi = pyi.div(2); }
      row.attr("id", "tableRegion" + fifthShiftStr);
      row.hover((() => visRegionHover(true, fifthShiftStr, fifthShift, pyi)),
                (() => visRegionHover(false, fifthShiftStr, fifthShift, pyi)));
      row.append($('<td>').html((fifthShift > 0 ? "+" : "") + fifthShift.toFraction()));
      row.append($('<td>').html(microtonal_utils.pySymb(pyi)));
    }
    else {
      row.append($('<td>').html("undef."));
      row.append($('<td>').html("undef."));
    }
    const loHtml = $('<span>').addClass("monoFont").text(fmtCents(lo.toCents(),3,true));
    const hiHtml = $('<span>').addClass("monoFont").text(fmtCents(hi.toCents(),3,true));
    row.append($('<td>').append(loHtml).append(" to ").append(hiHtml));
    $('#tableRegions').append(row);
  }
  // update the table of prime mappings
  $('#tablePrimes').empty();
  header = $('<tr>');
  header.append($('<th>').html("Prime"));
  header.append($('<th>').html("Fifth shift"));
  header.append($('<th>').html("Py. Intv."));
  header.append($('<th>').html("Error"));
  $('#tablePrimes').append(header);
  for (const p of primesGt5) {
    let row = $('<tr>');
    const fifthShift = microtonal_utils.fjsFifthShift(p, 1, spec);
    const pyi = microtonal_utils.Interval(3,2).pow(fifthShift).red();
    row.hover((() => changePrimeMarker(true, microtonal_utils.Interval(p).red(), fifthShift, pyi)),
              (() => changePrimeMarker(false)));
    row.append($('<td>').html(p));
    if (fifthShift != undefined) {
      const diff = pyi.div(p).reb().toCents();
      row.append($('<td>').html((fifthShift > 0 ? "+" : "") + fifthShift.toFraction()));
      row.append($('<td>').html(microtonal_utils.pySymb(pyi)));
      row.append($('<td>').html((diff > 0 ? "+" : "") + fmtCents(diff, 3, true))
                          .addClass("tablePrimesRightColumn"));
    }
    else {
      row.append($('<td>').html("undef."));
      row.append($('<td>').html("undef."));
      row.append($('<td>').html("undef."));
    }
    $('#tablePrimes').append(row);
  }
  // update the conversion
  updateConversion();
}

function visRegionHover(on, fifthShiftStr, fifthShift, pyi) {
  if (on) {
    visRegionIDs[fifthShiftStr].forEach(id => $(id).addClass("visRegionHighlighted"));
    $('#tableRegion' + fifthShiftStr).addClass("resTableTrHover");
    $('#visText').removeClass("hiddenKeepLayout");
    if (pyi == undefined) {
      pyi = microtonal_utils.Interval(3,2).pow(fifthShift).red();
    }
    let text = (fifthShift > 0 ? "+" : "") + fifthShift;
    text += " (" + microtonal_utils.pySymb(pyi) + ")";
    $('#highlightedRegionText').text("Region: " + text);
    $('#cursorText').addClass("hidden");
  }
  else {
    visRegionIDs[fifthShiftStr].forEach(id => $(id).removeClass("visRegionHighlighted"));
    $('#tableRegion' + fifthShiftStr).removeClass("resTableTrHover");
    $('#visText').addClass("hiddenKeepLayout");
    $('#highlightedRegionText').text("Nothing highlighted");
    $('#cursorText').removeClass("hidden");
  }
}

function changePrimeMarker(on, i, fifthShift, pyi) {
  for (const [fifthShiftStr, ids] of Object.entries(visRegionIDs)) {
    ids.forEach(id => $(id).removeClass("visRegionHighlighted"));
    $('#tableRegion' + fifthShiftStr).removeClass("resTableTrHover");
  }
  if (on) {
    visRegionHover(true, fmtFifthShiftIdNo(fifthShift), fifthShift, pyi);
    const markerStyle = "left: " + i.valueOf_log()*100 + "%;";
    $('#primeMarker').removeClass("hidden").attr("style", markerStyle);
    $('#visText').removeClass("hiddenKeepLayout");
    $('#cursorText').removeClass("hidden");
    $('#cursorText').text("Cursor: ");
    $('#cursorText').append($('<span>').addClass("monoFont")
                                       .text(fmtCents(i.toCents(), 1, true)));
  }
  else {
    $('#primeMarker').addClass("hidden");
    $('#visText').addClass("hiddenKeepLayout");
  }
}

function updateConversion(expr) {
  if (expr != undefined) {
    expr = expr.trim();
    $('#expr').val(expr);
  }
  else {
    expr = $('#expr').val();
  }
  $('#errors').addClass("hidden");
  $('#cvtResSize').text("-");
  $('#cvtResExpr').text("-");
  $('#cvtResSymb').text("-");
  if (expr === "") {
    return;
  }
  try {
    setConverterVisibility(true);
    const res = microtonal_utils.parseCvt($('#expr').val(), {fjsLikeSpecs: [spec]});
    const intv = res.type == "interval" ? res.intv : res.intvToRef.mul(res.ref.intvToA4);
    if (res.type == "interval") {
      $('#cvtResSizeLabel').text("Size in cents:");
      $('#cvtResSize').text(fmtCents(res.cents, 5));
      $('#cvtResExprLabel').text("Ratio:");
      if (res.ratio) {
        const str = toRatioStr(res.ratio);
        $('#cvtResExpr').html(fmtExtExprLink(str));
        $('#cvtXenCalc').attr("href", fmtXenCalcLink(str));
      }
      else {
        $('#cvtResExprLabel').text("Expression:");
        const [str_off, str_on] = fmtExpression(res.intv);
        if (str_on.length <= 30) {
          if (str_off !== str_on) {
            $('#cvtResExpr').addClass("hoverSwap");
            $('#cvtResExpr').empty();
            $('#cvtResExpr').append($('<span>').addClass('hoverSwap_off')
                                               .html(fmtExtExprLink(str_off, str_on)));
            $('#cvtResExpr').append($('<span>').addClass('hoverSwap_on')
                                               .html(fmtExtExprLink(str_on)));
          }
          else {
            $('#cvtResExpr').removeClass("hoverSwap");
            $('#cvtResExpr').html(fmtExtExprLink(str_on));
          }
        }
        $('#cvtXenCalc').attr("href", fmtXenCalcLink(str_on));
      }
    }
    if (res.type == "note") {
      $('#cvtResSizeLabel').text("Freq. in hertz:");
      $('#cvtResSize').html(fmtExtExprLink(fmtHertz(res.hertz, 5)));
      $('#cvtResExprLabel').text("Expression:");
      const refSymb = microtonal_utils.pyNote(res.ref.intvToA4);
      if (res.edoStepsToRef) {
        const str = fmtEDOStep(res.edoStepsToRef) + " * " + refSymb;
        $('#cvtResExpr').html(fmtExtExprLink(str));
        $('#cvtXenCalc').attr("href", fmtXenCalcLink(str));
      }
      else {
        let [str_off, str_on] = fmtExpression(res.intvToRef);
        str_off += " * " + refSymb;
        str_on += " * " + refSymb;
        if (str_on.length <= 33 + refSymb.length) {
          if (str_off !== str_on) {
            $('#cvtResExpr').addClass("hoverSwap");
            $('#cvtResExpr').empty();
            $('#cvtResExpr').append($('<span>').addClass('hoverSwap_off')
                                               .html(fmtExtExprLink(str_off, str_on)));
            $('#cvtResExpr').append($('<span>').addClass('hoverSwap_on')
                                               .html(fmtExtExprLink(str_on)));
          }
          else {
            $('#cvtResExpr').removeClass("hoverSwap");
            $('#cvtResExpr').html(fmtExtExprLink(str_on));
          }
        }
        $('#cvtXenCalc').attr("href", fmtXenCalcLink(str_on));
      }
    }
    const symb = res.type == "interval" ? microtonal_utils.fjsSymb(intv, spec)
                                        : microtonal_utils.fjsNote(intv, spec);
    const accs = microtonal_utils.fjsAccidentals(intv, spec);
    if (accs != undefined) {
      const {otos, utos, pyi} = accs;
      if (otos.length != 0 || utos.length != 0) {
        const otoStr = otos.length == 0 ? "" : "<sup>" + otos.join(",") + "</sup>";
        const utoStr = utos.length == 0 ? "" : "<sub>" + utos.join(",") + "</sub>";
        const withSupsSubs = (res.type == "interval" ? microtonal_utils.pySymb(pyi)
                                                     : microtonal_utils.pyNote(pyi))
                             + '<span class="supsub">' + otoStr + utoStr + '</span>';
        $('#cvtResSymb').addClass("hoverSwap");
        $('#cvtResSymb').empty();
        $('#cvtResSymb').append($('<span>').addClass('hoverSwap_off')
                                           .html(fmtExtExprLink(withSupsSubs, symb)));
        $('#cvtResSymb').append($('<span>').addClass('hoverSwap_on')
                                           .html(fmtExtExprLink(symb)));
      }
      else {
        $('#cvtResSymb').removeClass("hoverSwap");
        $('#cvtResSymb').html(symb);
      }
    }
  }
  catch (err) {
    if (err.kind == undefined) {
      newErr = new Error(err.name + (err.message ? "\n" + err.message : ""));
      newErr.stack = err.stack;
      console.error(newErr);
    }
    $('#errors').removeClass("hidden");
    const errStr = err.toString().replace("\n","<br>").replace("\\\\","\\");
    $('#errors').html($('<pre>').addClass("parseError").html(errStr));
  }
}

function setConverterVisibility(showConverter) {
  if (showConverter) {
    $('#converter').removeClass("hidden");
    $('#toggleConverter').text("hide converter");
  }
  else {
    $('#converter').addClass("hidden");
    $('#toggleConverter').text("show converter");
  }
}

// ================================================================
// Handling the URL and browser state
// ================================================================

function updateURL(doReplace) {
  let params = {"rotPreset": "", "rot": "", "fifthSeqPreset": "", "fifthSeq": ""};
  if ($('#rotPreset').val() == 0) {
    params["rot"] = $('#rot').val();
  }
  else if ($('#rotPreset').val() > 1) {
    params["rotPreset"] = $('#rotPreset').val();
  }
  if ($('#fifthSeqPreset').val() == 0) {
    params["fifthSeq"] = $('#fifthSeq').val();
  }
  else if ($('#fifthSeqPreset').val() > 1) {
    params["fifthSeqPreset"] = $('#fifthSeqPreset').val();
  }
  updateURLWithParams(params, doReplace);
}

function updateURLWithParams(paramsToUpdate, doReplace) {
  const url = new URL(window.location);
  for (const [param, val] of Object.entries(paramsToUpdate)) {
    if (val != undefined && (!val.trim || val.trim() !== "")) {
      url.searchParams.set(param, val);
    }
    else {
      url.searchParams.delete(param);
    }
  }
  updateURLTo(url, doReplace);
}

function updateURLTo(newURL, doReplace) {
  if (doReplace) {
    console.log(Date.now() + " [replaced] " + newURL.searchParams);
    history.replaceState({}, "", newURL);
  }
  else {
    console.log(Date.now() + " [pushed] " + newURL.searchParams);
    history.pushState({}, "", newURL);
  }
}

function initState() {
  const url = new URL(window.location);
  // On my machine firefox has weird behavior on refresh, so I always pushState
  // when refreshing on firefox on a non-blank page (which still gives weird
  // behavior, but at least it's better)
  // const doReplace =
  //   [...url.searchParams.entries()].length == 0;
  //   || !navigator.userAgent.toLowerCase().includes("firefox")
  //   || (performance && performance.getEntriesByType("navigation")[0].type != "reload");
  // ^ Commenting out this "fix" for now, because I can't replicate it (7/7/21)
  updateURLTo(url, true); // doReplace);
}

window.onpopstate = function(e) {
  const url = new URL(window.location);
  console.log(Date.now() + " [popped] " + url.searchParams);
  setStateFromURL(e);
};

function setStateFromURL(e) {
  const urlParams = new URLSearchParams(window.location.search);
  setStateFromParams(urlParams, e);
}

function setStateFromParams(urlParams, e) {
  const rotPresetP = parseInt(urlParams.get("rotPreset"));
  if (!isNaN(rotPresetP) && rotPresetP > 0 && rotPresetP <= rotPresets.length) {
    changeRoTPreset(rotPresetP, true);
  }
  else if (urlParams.has("rot")) {
    changeRoTValue(urlParams.get("rot"), true);
    changeRoTPreset(0, true);
  }
  else {
    changeRoTPreset(1, true);
  }
  const fifthSeqPresetP = parseInt(urlParams.get("fifthSeqPreset"));
  if (!isNaN(fifthSeqPresetP) && fifthSeqPresetP > 0 && fifthSeqPresetP <= fifthSeqPresets.length) {
    changeFifthSeqPreset(fifthSeqPresetP, true);
  }
  else if (urlParams.has("fifthSeq")) {
    changeFifthSeq(undefined, urlParams.get("fifthSeq"), true);
    changeFifthSeqPreset(0, true);
  }
  else {
    changeFifthSeqPreset(1, true);
  }
  let expr = urlParams.has('q') ? urlParams.get('q') : "";
  if (urlParams.has('expr')) {
    expr = urlParams.get('expr');
    updateURLWithParams({q: expr, expr: ""}, true);
  }
  $('#expr').val(expr);
  updateTables();
}


$(document).ready(function() {

  $('#rotPreset').append($('<option>').attr("value", 0).text("-"));
  for (let i = 1; i <= rotPresets.length; i++) {
    let opt = $('<option>').attr("value", i).text(rotPresets[i-1][0]);
    if (i == 1) { opt.attr('selected', true); }
    $('#rotPreset').append(opt);
  }
  $('#fifthSeqPreset').append($('<option>').attr("value", 0).text("-"));
  for (let i = 1; i <= fifthSeqPresets.length; i++) {
    let opt = $('<option>').attr("value", i).text(fifthSeqPresets[i-1][0]);
    if (i == 1) { opt.attr('selected', true); }
    $('#fifthSeqPreset').append(opt);
  }

  $('#rotPreset').change(function () { changeRoTPreset(); updateURL(); });
  $('#rot')      .change(function () { changeRoTValue(); updateURL(); });
  $('#rotSlider').on('input', function () {
    const doReplace = $('#rotPreset').val() == 0;
    changeRoTSlider();
    updateURL(doReplace);
  });
  $('#fifthSeqPreset').change(function () { changeFifthSeqPreset(); updateURL(); });
  $('#fifthSeq')      .change(function () { changeFifthSeq(); updateURL(); });
  $('#toggleConverter').click(function () {
    setConverterVisibility($('#toggleConverter').text() == "show converter");
  });

  setConverterVisibility(false);

  // the rest is (mostly) copy-pasted right from xen-calc

  setStateFromURL();
  initState();

  // reset button
  $('#reset').click(function () {
    updateURLWithParams({q: ""});
    updateConversion("");
  });

  // accidental buttons
  $('#add_dbl_flat') .click(function() { insertAtCursor("𝄫"); });
  $('#add_flat')     .click(function() { insertAtCursor("♭"); });
  $('#add_nat')      .click(function() { insertAtCursor("♮"); });
  $('#add_sharp')    .click(function() { insertAtCursor("♯"); });
  $('#add_dbl_sharp').click(function() { insertAtCursor("𝄪"); });

  // pressing enter while in the text box clicks the enter button
  $('#expr').keydown(function(event) {
    if (event.which === 13) {
      event.preventDefault();
      $('#enter').addClass('buttonActive');
    }
  });
  $('#expr').keyup(function(event) {
    if (event.which === 13) {
      $('#enter').removeClass('buttonActive');
      $('#enter').click();
    }
  });

  // pressing enter!
  $('#enter').click(function() {
    updateConversion();
    updateURLWithParams({q: $('#expr').val()});
  });

});
