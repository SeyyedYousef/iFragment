package username

import (
	"context"
	"strings"
	"testing"

	"ifragment-backend/internal/service/username/avm"
)

func TestSemanticThesaurusMatches(t *testing.T) {
	// Test rare synonyms
	rareSynonyms := avm.GetSemanticSynonyms("rare")
	if len(rareSynonyms) == 0 {
		t.Fatalf("expected semantic synonyms for 'rare', got none")
	}

	foundUnique := false
	foundScarce := false
	foundUncommon := false
	foundSingular := false

	for _, s := range rareSynonyms {
		switch s.Username {
		case "unique":
			foundUnique = true
		case "scarce":
			foundScarce = true
		case "uncommon":
			foundUncommon = true
		case "singular":
			foundSingular = true
		}
		// Ensure no affix spam is in the thesaurus
		if strings.HasPrefix(s.Username, "rare") && s.Username != "rare" {
			t.Errorf("thesaurus should not contain affix spam for 'rare', found %s", s.Username)
		}
	}

	if !foundUnique || !foundScarce || !foundUncommon || !foundSingular {
		t.Errorf("missing expected synonyms for 'rare': unique=%v, scarce=%v, uncommon=%v, singular=%v",
			foundUnique, foundScarce, foundUncommon, foundSingular)
	}

	// Test cars synonyms
	carsSynonyms := avm.GetSemanticSynonyms("cars")
	if len(carsSynonyms) == 0 {
		t.Fatalf("expected semantic synonyms for 'cars', got none")
	}

	foundAuto := false
	foundVehicle := false
	foundMotors := false
	foundDrive := false

	for _, s := range carsSynonyms {
		switch s.Username {
		case "auto":
			foundAuto = true
		case "vehicle":
			foundVehicle = true
		case "motors":
			foundMotors = true
		case "drive":
			foundDrive = true
		}
		if strings.HasPrefix(s.Username, "cars") && s.Username != "cars" {
			t.Errorf("thesaurus should not contain affix spam for 'cars', found %s", s.Username)
		}
	}

	if !foundAuto || !foundVehicle || !foundMotors || !foundDrive {
		t.Errorf("missing expected synonyms for 'cars': auto=%v, vehicle=%v, motors=%v, drive=%v",
			foundAuto, foundVehicle, foundMotors, foundDrive)
	}
}

func TestCandidatePoolNoAffixSpam(t *testing.T) {
	ctx := context.Background()

	// 1. Check pool for "rare"
	rarePool := getCandidatePool(ctx, nil, "rare")
	for _, name := range rarePool.names {
		if name == "rarex" || name == "rares" || name == "rarehq" || name == "rareapp" || name == "therare" {
			t.Errorf("candidate pool for 'rare' contains unwanted affix candidate: %s", name)
		}
	}

	// 2. Check pool for "cars"
	carsPool := getCandidatePool(ctx, nil, "cars")
	for _, name := range carsPool.names {
		if name == "carsx" || name == "carshq" || name == "carsapp" || name == "thecars" {
			t.Errorf("candidate pool for 'cars' contains unwanted affix candidate: %s", name)
		}
	}
}

func TestFindSimilarUsernamesSemantics(t *testing.T) {
	service := &AnalysisService{}
	ctx := context.Background()

	// Test for "rare"
	results, err := service.FindSimilarUsernames(ctx, "rare", 8)
	if err != nil {
		t.Fatalf("FindSimilarUsernames failed: %v", err)
	}
	if len(results) == 0 {
		t.Fatalf("expected similar usernames for 'rare', got empty")
	}

	hasSemanticWord := false
	for _, r := range results {
		// Verify no cheap affix handles appear
		if r.Username == "rarex" || r.Username == "rares" || r.Username == "rarehq" || r.Username == "rareapp" {
			t.Errorf("FindSimilarUsernames returned unwanted affix handle: %s", r.Username)
		}
		if r.Username == "unique" || r.Username == "scarce" || r.Username == "uncommon" || r.Username == "singular" {
			hasSemanticWord = true
			if r.Score < 0.90 {
				t.Errorf("expected score >= 0.90 for semantic synonym %s, got %f", r.Username, r.Score)
			}
		}
	}
	if !hasSemanticWord {
		t.Errorf("expected at least one top semantic synonym (unique/scarce/uncommon/singular) in results for 'rare'")
	}

	// Test for "cars"
	carsResults, err := service.FindSimilarUsernames(ctx, "cars", 8)
	if err != nil {
		t.Fatalf("FindSimilarUsernames for 'cars' failed: %v", err)
	}
	if len(carsResults) == 0 {
		t.Fatalf("expected similar usernames for 'cars', got empty")
	}

	hasAutoOrVehicle := false
	for _, r := range carsResults {
		if r.Username == "carsx" || r.Username == "carshq" || r.Username == "carsapp" {
			t.Errorf("FindSimilarUsernames returned unwanted affix handle: %s", r.Username)
		}
		if r.Username == "auto" || r.Username == "vehicle" || r.Username == "motors" || r.Username == "drive" {
			hasAutoOrVehicle = true
		}
	}
	if !hasAutoOrVehicle {
		t.Errorf("expected automotive peer (auto/vehicle/motors/drive) in results for 'cars'")
	}
}
