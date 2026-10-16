#!/usr/bin/env bash
# 一次性：建立 issue labels（需先 gh auth login）
set -e
gh label create clinical-logic --color B60205 --description "臨床規則、公式、門檻" --force
gh label create ui            --color 1D76DB --description "畫面與互動" --force
gh label create print         --color 5319E7 --description "列印報表" --force
gh label create sync          --color 0E8A16 --description "PouchDB / CouchDB 同步" --force
gh label create infra         --color 666666 --description "CI、部署、工作流" --force
