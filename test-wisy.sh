#!/bin/bash
BASE="https://chatbot-backend-clean-eord.onrender.com/chat"

echo "👉 Test 1: Öffnungszeiten"
curl -s -X POST $BASE -H "Content-Type: application/json" -d 
'{"message":"bis wann habt ihr heute geöffnet?"}'
echo -e "\n"

echo "👉 Test 2: Öffnungszeiten (andere Formulierung)"
curl -s -X POST $BASE -H "Content-Type: application/json" -d 
'{"message":"wie sind eure Öffnungszeiten?"}'
echo -e "\n"

echo "👉 Test 3: Adresse"
curl -s -X POST $BASE -H "Content-Type: application/json" -d 
'{"message":"wo finde ich euch?"}'
echo -e "\n"

echo "👉 Test 4: Parkplatz"
curl -s -X POST $BASE -H "Content-Type: application/json" -d 
'{"message":"gibt es Parkplätze bei euch?"}'
echo -e "\n"

echo "👉 Test 5: Behandlung (Haare am Rücken)"
curl -s -X POST $BASE -H "Content-Type: application/json" -d 
'{"message":"ich habe haare am rücken"}'
echo -e "\n"

echo "👉 Test 6: Behandlung (Akne)"
curl -s -X POST $BASE -H "Content-Type: application/json" -d 
'{"message":"ich habe akne"}'
echo -e "\n"

echo "👉 Test 7: Kontakt"
curl -s -X POST $BASE -H "Content-Type: application/json" -d 
'{"message":"ich brauche kontakt"}'
echo -e "\n"

echo "👉 Test 8: Fallback (unbekannte Frage)"
curl -s -X POST $BASE -H "Content-Type: application/json" -d 
'{"message":"habt ihr auch Solarium?"}'
echo -e "\n"

